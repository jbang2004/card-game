#!/usr/bin/env python3
"""Static file server for local play and the browser tests (standard library only).

The web build loads about 850 files at once. `python3 -m http.server` listens with a queue of 5, so under that burst
the OS resets some connections (net::ERR_CONNECTION_RESET on a script): the game never starts, and a Playwright test
waits out its whole timeout. This serves a thread per request from a deep queue, and logs nothing unless --verbose.

    python3 tools/serve.py [port]                    serve the repository (the game is at /dist/ and /index.html)
    python3 tools/serve.py 8000 --directory dist     serve one folder
"""
import argparse
import functools
import http.server
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    verbose = False

    def log_message(self, *args):
        if self.verbose:
            super().log_message(*args)


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 512
    daemon_threads = True


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("port", nargs="?", type=int, default=8000)
    ap.add_argument("--bind", default="127.0.0.1")
    ap.add_argument("--directory", default=str(ROOT))
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()
    Handler.verbose = args.verbose
    handler = functools.partial(Handler, directory=args.directory)
    with Server((args.bind, args.port), handler) as server:
        server.serve_forever()
