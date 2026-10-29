from tasktracker.bootstrap import create_app
from tasktracker.infrastructure.settings import get_settings

app = create_app(get_settings())
