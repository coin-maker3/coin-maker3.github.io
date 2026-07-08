"""Pipeline stages: ingest -> extract -> redaction -> classify -> map ->
aggregate -> generate.

Each stage updates the document's StageStatus so failures are visible, never
silent (a core design rule). Stages are pure-ish: they take inputs and return
results + a StageStatus, and the runner persists them.
"""
