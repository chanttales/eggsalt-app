-- Stable keys for boards and items. Board graphs point at them (create_linked_card names a board,
-- stock rules may name an item), and a template is copied into a workspace by key. Renaming a
-- board or item changes its name only. The same format as graph keys in packages/domain.

alter table board add column key text not null
  check (key ~ '^[a-z][a-z0-9_]{0,47}$');
alter table board add constraint board_workspace_key_unique unique (workspace_id, key);

alter table item add column key text not null
  check (key ~ '^[a-z][a-z0-9_]{0,47}$');
alter table item add constraint item_workspace_key_unique unique (workspace_id, key);
