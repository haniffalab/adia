import json

from flask import current_app
from sqlalchemy import exc
import scanpy as sc
import pandas as pd

from adifa import models
from adifa.resources.errors import InvalidDatasetIdError, DatabaseOperationError, DatasetNotExistsError

def get_matrixplot(
	datasetId, 
	var_names, 
	groupby, 
	use_raw=None, 
	log=False, 
	num_categories=7, 
	figsize=None, 
	dendrogram=False, 
	title=None, 
	cmap='viridis', 
	colorbar_title='Mean expression\\nin group',
	gene_symbols=None, 
	var_group_positions=None, 
	var_group_labels=None, 
	var_group_rotation=None, 
	layer=None, 
	standard_scale=None,
	values_df=None, 
	swap_axes=False, 
	show=None, 
	save=None, 
	ax=None, 
	return_fig=True,
	vmin=None,
	vmax=None,
	vcenter=None,
	norm=None,
	**kwds):
	if not datasetId > 0 :
		raise InvalidDatasetIdError

	try:
		dataset = models.Dataset.query.get(datasetId)
	except exc.SQLAlchemyError as e:
		raise DatabaseOperationError

	try:
		adata = current_app.adata[dataset.filename]		
	except (ValueError, AttributeError) as e:
		raise DatasetNotExistsError

	plot = sc.pl.matrixplot(adata, var_names, groupby, use_raw, log, num_categories, figsize, dendrogram, title, cmap, colorbar_title, gene_symbols, var_group_positions, var_group_labels, var_group_rotation, layer, standard_scale, values_df, swap_axes, show, save, ax, return_fig, vmin, vmax, vcenter, norm)

	if isinstance(plot.categories, pd.IntervalIndex):
		categories = [ "({}, {}]".format(interval.left, interval.right) for interval in plot.categories.values ]
	else:
		categories = list(plot.categories)

	output = {
		"categories": categories,
		"var_names": plot.var_names,
		"values_df": json.loads(plot.values_df.to_json()),
		"min_value": str(plot.values_df.min().min()),
		"max_value": str(plot.values_df.max().max())
	}

	return output