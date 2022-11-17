import json

from flask import request
from flask_restful import Resource

from adifa.utils.plotting import get_matrixplot, get_spatial_plot


class Matrixplot(Resource):
    def get(self, id):
        groupby = request.args.get("groupby", "", type=str)
        var_names = request.args.getlist("var_names")

        return get_matrixplot(id, var_names, groupby)

class Spatial(Resource):
    def get(self, id):
        
        return get_spatial_plot(id)

