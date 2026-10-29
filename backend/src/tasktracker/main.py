import logging

from tasktracker.bootstrap import create_app
from tasktracker.infrastructure.settings import get_settings

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("alembic.runtime.migration").setLevel(logging.WARNING)
app = create_app(get_settings())
