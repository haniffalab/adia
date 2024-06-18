from flask import Blueprint
from flask_restful import Api

from adifa.resources.about import About
from adifa.resources.datasets import (
    Bounds,
    CellByGeneAggregates,
    Coordinates,
    Masks,
    Dataset,
    Datasets,
    Labels,
    SearchGenes,
    SearchDiseases,
    SearchDiseaseGene,
)
from adifa.resources.plotting import Matrixplot, Spatial
from adifa.resources.errors import errors


bp = Blueprint("api_v1", __name__)
api = Api(bp, errors=errors)

api.add_resource(About, "/about")
api.add_resource(Bounds, "/bounds")
api.add_resource(CellByGeneAggregates, "/datasets/<id>/cxg")
api.add_resource(Coordinates, "/coordinates")
api.add_resource(Dataset, "/datasets/<id>")
api.add_resource(Datasets, "/datasets")
api.add_resource(Masks, "/masks")
api.add_resource(Labels, "/labels")
api.add_resource(SearchGenes, "/datasets/<id>/search/genes")
api.add_resource(SearchDiseases, "/datasets/<id>/search/diseases")
api.add_resource(SearchDiseaseGene, "/search/disease_gene")
api.add_resource(Matrixplot, "/datasets/<int:id>/plotting/matrixplot")
api.add_resource(Spatial, "/datasets/<int:id>/plotting/spatial")
