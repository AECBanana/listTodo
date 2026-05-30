-- 清理不存在用户的数据
DELETE FROM deleted_entities WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM tags WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM projects WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM tasks WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM user_settings WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM server_settings WHERE user_id NOT IN (SELECT id FROM users);

-- 清理 entity_id 指向不存在记录的已删除实体
DELETE FROM deleted_entities WHERE entity_type = 'project' AND entity_id NOT IN (SELECT id FROM projects);
DELETE FROM deleted_entities WHERE entity_type = 'task' AND entity_id NOT IN (SELECT id FROM tasks);
DELETE FROM deleted_entities WHERE entity_type = 'tag' AND entity_id NOT IN (SELECT id FROM tags);
