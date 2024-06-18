import os
import re
from flask import current_app
from sqlalchemy import exc
import numpy as np
import pandas as pd
import zarr

from adifa import models
from adifa.resources.errors import (
    InvalidDatasetIdError,
    DatabaseOperationError,
    DatasetNotExistsError,
)


def get_group_index_name(group):
    if "_index" in group.attrs:
        return group.attrs["_index"]
    else:
        return "_index"


def get_group_index(group):
    if "_index" in group.attrs:
        return group[group.attrs["_index"]]
    else:
        return group["_index"]


def parse_data(data, store=None):
    if isinstance(data, zarr.Group):
        return parse_group(data)
    elif isinstance(data, zarr.Array):
        return parse_array(store, data)


# anndata versions >=0.8.0 write categorical values in a Group with categories and codes
def parse_group(group):
    if "_index" in group.attrs:
        df = pd.DataFrame(index=group[group.attrs["_index"]])
        for name in [
            name
            for name in group.array_keys()
            if not name.startswith("_") and name != get_group_index_name(group)
        ]:
            df[name] = group[name]
        for name in group.group_keys():
            df[name] = parse_group(group[name])
        return df
    elif "codes" in group and "categories" in group:
        series = pd.Categorical.from_codes(
            group["codes"][:], categories=group["categories"][:]
        )
        if np.array_equal(
            np.sort(series.categories.values), np.sort(["True", "False"])
        ):
            return series.map({"True": True, "False": False}).astype(bool)
        return series


# anndata versions <0.8.0 write categorical values in an Array with categories in a separate group
def parse_array(store, array):
    if "categories" in array.attrs:
        series = pd.Categorical.from_codes(
            array[:],
            categories=store[
                os.path.join(os.path.dirname(array.path), array.attrs["categories"])
            ],
        )
        if np.array_equal(
            np.sort(series.categories.values), np.sort(["True", "False"])
        ):
            return series.map({"True": True, "False": False}).astype(bool)
        return series
    else:
        return array[:]


def get_annotations(adata):
    annotations = {"obs": {}, "obsm": [], "var": [], "has_masks": False}

    switcher = {
        "category": type_category,
        "bool": type_bool,
        "int": type_numeric,
        "float": type_numeric,
        "complex": type_numeric,
    }

    obs_cat = {}
    OBS_GROUPING = "column_ordering"
    if OBS_GROUPING in adata["uns"].group_keys():
        for k in adata["uns"][OBS_GROUPING]:
            for v in adata["uns"][OBS_GROUPING][k]:
                obs_cat[v] = k

    for name in [
        name
        for name in adata["obs"].array_keys()
        if not name.startswith("_") and name != get_group_index_name(adata["obs"])
    ]:
        array = parse_array(adata, adata["obs"][name])
        # Map numpy dtype to a simple type for switching
        dtype = re.sub(r"[^a-zA-Z]", "", array.dtype.name)
        # Get the function from switcher dictionary
        func = switcher.get(dtype, type_discrete)
        # Define an API key safe
        slug = re.sub(r"[^a-zA-Z0-9]", "", name).lower()

        annotations["obs"][slug] = func(array)
        annotations["obs"][slug]["name"] = name
        annotations["obs"][slug]["category"] = obs_cat.get(name, "main")

    for group in [
        group
        for group in adata["obs"].group_keys()
        if not group.startswith("_") and group != get_group_index_name(adata["obs"])
    ]:
        if all(
            a in list(adata["obs"][group].array_keys()) for a in ["categories", "codes"]
        ):
            array = parse_group(adata["obs"][group])
            dtype = re.sub(r"[^a-zA-Z]", "", array.dtype.name)
            # Get the function from switcher dictionary
            func = switcher.get(dtype, type_discrete)
            # Define an API key safe
            slug = re.sub(r"[^a-zA-Z0-9]", "", group).lower()

            annotations["obs"][slug] = func(array)
            annotations["obs"][slug]["name"] = group
            annotations["obs"][slug]["category"] = obs_cat.get(group, "main")

    annotations["obsm"] = [value for value in adata["obsm"].array_keys()]
    annotations["var"] = list(get_group_index(adata["var"])[:])

    if "masks" in adata["uns"] and len(adata["uns"]["masks"].keys()):
        annotations["has_masks"] = True

    return annotations


def get_degs(adata):
    # try:
    #     sc.pp.normalize_total(adata, target_sum=1e4)
    #     sc.pp.log1p(adata)
    #     sc.pp.highly_variable_genes(adata, min_mean=0.0125, max_mean=3, min_disp=0.5)
    #     adata.var.sort_values(by=["means"], ascending=False)
    #     df = (
    #         adata.var[adata.var["highly_variable"] == True]
    #         .sort_values(by=["means"], ascending=False)
    #         .head(10)
    #     )
    #     return df.index.tolist()
    # except Exception as e:
    #     return False
    return False


def get_bounds(datasetId, obsm):
    if not datasetId > 0:
        raise InvalidDatasetIdError

    try:
        dataset = models.Dataset.query.get(datasetId)
    except exc.SQLAlchemyError:
        raise DatabaseOperationError

    try:
        adata = current_app.adata[dataset.filename]
    except (ValueError, AttributeError):
        raise DatasetNotExistsError

    # Normalised [-1,1] @TODO
    norm_obsm = (
        2.0
        * (adata["obsm"][obsm][:] - np.min(adata["obsm"][obsm][:]))
        / np.ptp(adata["obsm"][obsm][:])
        - 1
    )

    # Embedded coordinate bounds
    output = {
        "x": {
            "min": encode_dtype(np.nanmin(norm_obsm[:, 0])),
            "max": encode_dtype(np.nanmax(norm_obsm[:, 0])),
        },
        "y": {
            "min": encode_dtype(np.nanmin(norm_obsm[:, 1])),
            "max": encode_dtype(np.nanmax(norm_obsm[:, 1])),
        },
    }

    return output


def get_coordinates(datasetId, obsm):
    if not datasetId > 0:
        raise InvalidDatasetIdError

    try:
        dataset = models.Dataset.query.get(datasetId)
    except exc.SQLAlchemyError:
        raise DatabaseOperationError

    try:
        adata = current_app.adata[dataset.filename]
    except (ValueError, AttributeError):
        raise DatasetNotExistsError

    # Normalised [-1,1] @TODO
    norm_obsm = (
        2.0
        * (adata["obsm"][obsm][:] - np.min(adata["obsm"][obsm][:]))
        / np.ptp(adata["obsm"][obsm][:])
        - 1
    )

    # True resolution sample generation
    output = []
    for x in norm_obsm:
        # output.append(x[:2].tolist())
        output.append([encode_dtype(round(num, 4)) for num in x[:2].tolist()])

    return output


def get_masks(datasetId):
    dataset = models.Dataset.query.get(datasetId)
    adata = current_app.adata[dataset.filename]

    if "masks" in adata["uns"]:
        return list(adata["uns"]["masks"].keys())
    else:
        return []


def get_labels(datasetId, obsm, gene="", obs=""):
    dataset = models.Dataset.query.get(datasetId)
    adata = current_app.adata[dataset.filename]

    if gene:
        try:
            output = [0] * get_group_index(adata["obs"]).shape[0]
            # expression = adata[:,gene].X/max(1,adata[:,gene].X.max())
            gene_idx = np.where(get_group_index(adata["var"])[:] == gene)[0][0]
            expression = adata["X"][:, gene_idx]
            nonzero_idx = np.nonzero(expression)[0]
            for i in nonzero_idx:
                output[i] = str(round(expression[i], 4))
        except KeyError:
            # @todo HANDLE ERROR
            output = [0] * get_group_index(adata["obs"]).shape[0]
        except IndexError:
            # @todo HANDLE ERROR
            output = [0] * get_group_index(adata["obs"]).shape[0]
    elif obs:
        try:
            if type(adata["obs"][obs]).__name__ == "Group":
                output = [str(x) for x in list(parse_group(adata["obs"][obs]))]
            else:
                output = [str(x) for x in list(parse_array(adata, adata["obs"][obs]))]
        except KeyError:
            # @todo HANDLE ERROR
            output = [0]
        except IndexError:
            # @todo HANDLE ERROR
            output = [0]

    return output


def search_genes(datasetId, searchterm):
    dataset = models.Dataset.query.get(datasetId)
    adata = current_app.adata[dataset.filename]
    output = [
        g for g in get_group_index(adata["var"])[:] if searchterm.lower() in g.lower()
    ]

    return output


def gene_search(datasetId, searchterm):
    dataset = models.Dataset.query.get(datasetId)
    adata = current_app.adata[dataset.filename]
    # adata = current_app.adata
    genes = [g for g in get_group_index(adata["var"])[:] if searchterm in g]

    output = []
    for gene in genes:
        sample = {"name": gene}
        output.append(sample)

    return output


# def categorised_expr(datasetId, cat, gene, func="mean"):
#     dataset = models.Dataset.query.get(datasetId)
#     adata = current_app.adata[dataset.filename]
# def categorised_expr(datasetId, cat, gene, func="mean"):
#     dataset = models.Dataset.query.get(datasetId)
#     adata = current_app.adata[dataset.filename]

#     data = adata[:, [gene]].to_df()
#     grouping = data.join(adata.obs[cat]).groupby(cat)
#     data = adata[:, [gene]].to_df()
#     grouping = data.join(adata.obs[cat]).groupby(cat)

#     if func == "mean":
#         expr = grouping.mean()
#     elif func == "median":
#         expr = grouping.median()
#     if func == "mean":
#         expr = grouping.mean()
#     elif func == "median":
#         expr = grouping.median()

#     # counts = grouping.count()/grouping.count().sum()
#     # 'count': counts.loc[group,gene]
#     output = [
#         {"gene": gene, "cat": group, "expr": float(expr.loc[group, gene])}
#         for group in grouping.groups.keys()
#     ]

#     return output
#     return output


def cat_expr_w_counts(datasetId, cat, gene, func="mean"):
    from numpy import NaN

    dataset = models.Dataset.query.get(datasetId)
    adata = current_app.adata[dataset.filename]

    gene_idx = np.where(get_group_index(adata["var"])[:] == gene)[0][0]
    cat_df = pd.DataFrame(
        (
            parse_group(adata["obs"][cat])
            if type(adata["obs"][cat]).__name__ == "group"
            else parse_array(adata, adata["obs"][cat])
        ),
        index=get_group_index(adata["obs"])[:],
        columns=[cat],
    )
    gene_df = pd.DataFrame(
        adata["X"][:, gene_idx], index=get_group_index(adata["obs"]), columns=[gene]
    )

    groupall = gene_df.join(cat_df).groupby(cat)
    groupexpr = (
        gene_df.replace(float(adata["X"][:, gene_idx].min()), NaN)
        .join(cat_df)
        .groupby(cat)
    )

    if func == "mean":
        expr = groupexpr.mean()
    elif func == "median":
        expr = groupexpr.median()

    countpc = (groupexpr.count() * 100 / groupall.count()).astype(int)

    output = [
        {
            "gene": gene,
            "cat": group,
            "expr": float(expr.loc[group, gene]),
            "count": int(countpc.loc[group, gene]),
        }
        for group in groupall.groups.keys()
    ]

    return output


def mode(d):
    from scipy import stats as s

    mode = s.mode(d)
    return int(mode[0])


def type_category(obs, from_discrete=False):
    categories = [str(i) for i in obs.categories.values.flatten()]

    if from_discrete:
        obs_type = "discrete"
    elif pd.api.types.is_string_dtype(obs.categories.dtype):
        if all(
            obs.categories.str.match(
                "^(\d{4})-(0[1-9]|1[0-2]|[1-9])-([1-9]|0[1-9]|[1-2]\d|3[0-1])$"
            )
        ):
            obs_type = "date"
        else:
            obs_type = "categorical"

    if len(categories) > 100 and (
        from_discrete or current_app.config.get("TRUNCATE_OBS", True)
    ):
        return {
            "type": obs_type,
            "is_truncated": True,
            "values": dict(enumerate(categories[:99], 1)),
        }

    return {
        "type": obs_type,
        "is_truncated": False,
        "values": dict(enumerate(categories, 1)),
    }


def type_bool(obs):
    return {"type": "boolean", "values": {1: "True", 0: "False"}}


def type_numeric(obs):
    accuracy = 4
    return {
        "type": "continuous",
        "min": encode_dtype(round(ndarray_min(obs), accuracy)),
        "max": encode_dtype(round(ndarray_max(obs), accuracy)),
        "mean": encode_dtype(round(ndarray_mean(obs), accuracy)),
        "median": encode_dtype(round(ndarray_median(obs), accuracy)),
    }


def type_discrete(obs):
    return type_category(pd.Series(obs).astype("category").cat, from_discrete=True)


def ndarray_max(a):
    if np.isnan(a).all():
        return 0
    else:
        return np.nanmax(a)


def ndarray_min(a):
    if np.isnan(a).all():
        return 0
    else:
        return np.nanmin(a)


def ndarray_mean(a):
    if np.isnan(a).all():
        return 0
    else:
        return np.nanmean(a)


def ndarray_median(a):
    if np.isnan(a).all():
        return 0
    else:
        return np.nanmedian(a)


def encode_dtype(a):
    if hasattr(a, "dtype"):
        if isinstance(a, np.integer):
            return int(a)
        if isinstance(a, np.floating):
            return float(a)
        if isinstance(a, np.bool_):
            return bool(a)
        if isinstance(a, np.ndarray) or isinstance(a, pd.Categorical):
            return a.tolist()
        return a
    else:
        return a


def disease_filename():
    return (
        os.path.join(current_app.config.get("DATA_PATH"), "disease.csv")
        if os.path.isfile(
            os.path.join(current_app.config.get("DATA_PATH"), "disease.csv")
        )
        else os.path.join(current_app.root_path, "data", "disease.csv")
    )


def get_disease_data(gene):
    datafile = disease_filename()
    try:
        df = pd.read_csv(datafile)
        return df[df["Gene mutation"] == gene].to_dict("records")
    except Exception:
        return []
