CREATE TABLE polls (
  poll_index INTEGER PRIMARY KEY,
  creator TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_index INTEGER NOT NULL,
  depositor TEXT NOT NULL,
  anti_amount INTEGER NOT NULL,
  pro_amount INTEGER NOT NULL,
  u_value INTEGER NOT NULL,
  s_value INTEGER NOT NULL,
  deposited_at INTEGER NOT NULL,
  FOREIGN KEY(poll_index) REFERENCES polls(poll_index)
);

CREATE TABLE equalisations (
  poll_index INTEGER PRIMARY KEY,
  truth_values TEXT NOT NULL,
  total_anti INTEGER NOT NULL,
  total_pro INTEGER NOT NULL,
  equalised_at INTEGER NOT NULL,
  FOREIGN KEY(poll_index) REFERENCES polls(poll_index)
);

CREATE TABLE withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_index INTEGER NOT NULL,
  user_address TEXT NOT NULL,
  anti_amount INTEGER NOT NULL,
  pro_amount INTEGER NOT NULL,
  withdrawn_at INTEGER NOT NULL,
  FOREIGN KEY(poll_index) REFERENCES polls(poll_index)
);

CREATE INDEX idx_deposits_poll ON deposits(poll_index);
CREATE INDEX idx_deposits_user ON deposits(depositor);
CREATE INDEX idx_withdrawals_poll ON withdrawals(poll_index);
CREATE INDEX idx_withdrawals_user ON withdrawals(user_address);