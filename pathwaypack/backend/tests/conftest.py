import os

# Tests run in development with unverified draft rules permitted, unless a test
# overrides ENVIRONMENT to exercise the production gate.
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("ALLOW_UNVERIFIED_RULES", "1")
