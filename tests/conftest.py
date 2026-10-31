import os
import re
import socket
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

ALLOWED_ENV = {
    "CI",
    "GITHUB_ACTIONS",
    "PYTHONPATH",
    "PYTEST_CURRENT_TEST",
    "PYTEST_VERSION",
    "TMPDIR",
    "TEMP",
    "TMP",
    "HOME",
    "PATH",
    "USER",
    "SHELL",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "LC_COLLATE",
    "LC_MESSAGES",
    "TERM",
}


def _looks_like_secret(name: str) -> bool:
    key = name.upper()
    if key in ALLOWED_ENV:
        return False
    if re.fullmatch(r"(?i).*(api[_-]?key|secret|token).*", key):
        return True
    return False


@pytest.fixture(autouse=True)
def _no_api_keys(monkeypatch):
    for name, value in list(os.environ.items()):
        if value and _looks_like_secret(name):
            pytest.fail(f"API-key-like environment variable is forbidden in tests: {name}={value[:12]}...")
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    class BlockedSocket:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("network disabled in tests")

        def __getattr__(self, *args, **kwargs):
            raise RuntimeError("network disabled in tests")

    monkeypatch.setattr(socket, "socket", BlockedSocket)
    monkeypatch.setattr(socket, "create_connection", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("network disabled in tests")))
    yield


@pytest.fixture(autouse=True)
def _isolate_tmp(tmp_path, monkeypatch):
    # Do not rewrite TMPDIR/TEMP/TMP globally; pytest manages per-test temporary paths and this preserves parallel safety.
    assert tmp_path.exists()
    yield


@pytest.fixture
def sample_symbols():
    return ["RELIANCE", "TCS", "INFY", "HDFCBANK"]
