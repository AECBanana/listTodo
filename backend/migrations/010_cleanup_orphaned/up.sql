-- 清理 orphaned 数据
-- 注意：所有含 user_id 的表都有 ON DELETE CASCADE，用户级清理由 FK 自动处理
-- 此处仅清理 deleted_entities 中指向不存在记录的条目

DELETE FROM deleted_entities
WHERE entity_type = 'project'
  AND entity_id NOT IN (SELECT id FROM projects);

DELETE FROM deleted_entities
WHERE entity_type = 'task'
  AND entity_id NOT IN (SELECT id FROM tasks);

DELETE FROM deleted_entities
WHERE entity_type = 'tag'
  AND entity_id NOT IN (SELECT id FROM tags);
