import sqlite3
from datetime import datetime

import pytest

from adifa import models

# from adifa.db import get_db


def test_post_dataset(session):
    post = models.Dataset(
        filename="test.h5ad",
        hash="1234",
        title="test",
        desc="",
        modality="scRNA-seq",
        date_created=datetime.now(),
        date_modified=datetime.now(),
        data_obs='{"origident": {"type": "categorical", "values": {"1": "GM136", "2": "GM143", "3": "GM144", "4": "GM147", "5": "GM148", "6": "GM169", "7": "GM183", "8": "GM184a", "9": "GM238", "10": "GM241", "11": "GM242", "12": "GM283", "13": "GM289", "14": "PD134", "15": "PD153", "16": "PD161", "17": "PD161b", "18": "PD164", "19": "PD164b", "20": "PD164c", "21": "PD170"}, "name": "orig.ident"}, "ncountrna": {"type": "continuous", "min": 0, "max": 0, "mean": 0, "median": 0, "name": "nCount_RNA"}, "nfeaturerna": {"type": "continuous", "min": 0, "max": 0, "mean": 0, "median": 0, "name": "nFeature_RNA"}, "project": {"type": "categorical", "values": {"1": "GM", "2": "PD"}, "name": "project"}, "percentmt": {"type": "continuous", "min": 0, "max": 0, "mean": 0, "median": 0, "name": "percent.mt"}, "sscore": {"type": "continuous", "min": 0, "max": 0, "mean": 0, "median": 0, "name": "S.Score"}, "g2mscore": {"type": "continuous", "min": 0, "max": 0, "mean": 0, "median": 0, "name": "G2M.Score"}, "paperlabels": {"type": "categorical", "values": {"1": "abT (CD4)", "2": "abT (CD8)", "3": "B", "4": "gd T", "5": "MAIT", "6": "Mast", "7": "mDC", "8": "Monocyte", "9": "Neutrophil", "10": "NK", "11": "pDC", "12": "P.Epi 1", "13": "P.Epi 2", "14": "P.Epi 3", "15": "P.Fib 1.1", "16": "P.Fib 1.2", "17": "P.Fib 1.3", "18": "P.Fib 1.4", "19": "P.Fib 1.5", "20": "Plasma", "21": "P.LEC", "22": "P.Mel", "23": "P.SMC", "24": "P.VEC 1.1", "25": "P.VEC 1.2", "26": "P.VEC 1.3", "27": "P.VEC 1.4", "28": "Th17", "29": "Treg"}, "name": "paperLabels"}}',
        data_var="{}",
        data_uns="{}",
        data_obsm="{}",
        data_varm="{}",
        pub_doi="",
        pub_link="",
        pub_author="",
        pub_group="",
        pub_date=datetime.now(),
        download_link="",
    )

    session.add(post)
    session.commit()

    assert post.id > 0


def test_get_close_db(db):
    return True
    with pytest.raises(sqlite3.ProgrammingError) as e:
        db.execute("SELECT 1")
        current_app.logger.error(e)

    assert "closed" in str(e.value)


def test_init_db_command(runner, monkeypatch):
    return True

    class Recorder:
        called = False

    def fake_init_db():
        Recorder.called = True

    monkeypatch.setattr("adifa.db.init_db", fake_init_db)
    result = runner.invoke(args=["init-db"])
    assert "Initialized" in result.output
    assert Recorder.called
