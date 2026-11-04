CREATE TABLE pf_sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, skin TEXT NOT NULL DEFAULT 'ivory', created INTEGER NOT NULL);
CREATE TABLE pf_profiles (owner TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE pf_rooms (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, mode TEXT NOT NULL, host TEXT NOT NULL, guest TEXT, status TEXT NOT NULL, state TEXT, version INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, host_seen INTEGER NOT NULL, guest_seen INTEGER NOT NULL DEFAULT 0, host_input TEXT NOT NULL DEFAULT '{}', guest_input TEXT NOT NULL DEFAULT '{}');
CREATE INDEX pf_matchmaking ON pf_rooms(mode,status,updated);
CREATE INDEX pf_host ON pf_rooms(host,status);
CREATE INDEX pf_guest ON pf_rooms(guest,status);
