# Published calendars (encrypted)

Each `*.enc.json` file is a calendar published from the studio. Every entry is
encrypted with its own key (AES-256-GCM, derived from the master key): this
folder can be public, nobody can read an entry before the robot opens it.

The master key is never in Git: it lives in `data/master.key` on the studio
computer and in the `DATEDLY_MASTER_KEY` secret of the GitHub repository.
