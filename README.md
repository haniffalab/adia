
[![tests](https://github.com/haniffalab/adifa/actions/workflows/test-coverage.yml/badge.svg)](https://github.com/haniffalab/adifa/actions/workflows/test-coverage.yml)
[![build](https://github.com/haniffalab/adifa/actions/workflows/docker-release.yml/badge.svg)](https://github.com/haniffalab/adifa/actions/workflows/docker-release.yml)
[![docker](https://github.com/haniffalab/adifa/actions/workflows/docker-latest.yml/badge.svg)](https://github.com/haniffalab/adifa/actions/workflows/docker-latest.yml)
[![sphinx](https://github.com/haniffalab/adifa/actions/workflows/sphinx-build.yml/badge.svg)](https://github.com/haniffalab/adifa/actions/workflows/sphinx-build.yml)
[![codecov](https://codecov.io/gh/haniffalab/adifa/branch/main/graph/badge.svg?token=RQLL0HKQ5W)](https://codecov.io/gh/haniffalab/adifa)
[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit&logoColor=white)](https://github.com/pre-commit/pre-commit)
[![python](https://img.shields.io/badge/python-3.8-blue)](https://python.org)

# Adifa - Annotated Data in Flask App

<img src="./sphinx/logo.png" alt="Adifa Logo" width="100" align="right"/>

[![docs](https://img.shields.io/badge/Documentation-online-blue)](https://haniffalab.github.io/adifa)
[![doi](https://zenodo.org/badge/DOI/10.5281/zenodo.5824895.svg)](https://doi.org/10.5281/zenodo.5824895)

Adifa is a framework for visualising single-cell gene expression data in a web browser. It is built on [Flask](https://flask.palletsprojects.com/), a micro web framework, and ingests [Annotated Data](https://anndata.readthedocs.io/) objects in the `.h5ad` file format. It includes dimensionality reduction visualisation, heatmaps and dotplots, with the ability to explore gene expression and disease markers. The Python-based implementation and usage of the [deck.gl](https://deck.gl/) framework allows efficient handling of datasets up to one million cells.

Read the [documentation](https://haniffalab.github.io/adifa). If you’d like to contribute by opening an issue or creating a pull request, please take a look at our [contributing guide](CONTRIBUTING.md). If Adifa is useful for your research, consider [citing the software](https://haniffalab.com/adifa/citing.html). 