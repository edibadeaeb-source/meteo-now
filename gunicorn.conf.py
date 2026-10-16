"""Keep operational access logs without URL parameters or client metadata."""

# Gunicorn automatically reads this file from the service working directory.
# m/U/H keep the method/path/protocol; r and q would expose URL parameters.
# Do not log referrers, user agents, authorization headers or client addresses.
access_log_format = '%(t)s "%(m)s %(U)s %(H)s" %(s)s %(b)s %(L)s'
