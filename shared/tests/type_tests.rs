use shared::{ApiResponse, CreateTaskRequest, Priority, TaskKind, UpdateTaskRequest};

#[test]
fn test_create_task_request_defaults() {
    let req = CreateTaskRequest {
        id: None,
        title: "test".into(),
        description: None,
        kind: TaskKind::Task,
        priority: Priority::None,
        is_pinned: false,
        due_date: None,
        start_date: None,
        project_id: None,
        parent_id: None,
        tags: vec![],
        is_favorite: false,
    };
    assert_eq!(req.title, "test");
    assert_eq!(req.priority, Priority::None);
    assert!(req.tags.is_empty());
}

#[test]
fn test_update_task_request_partial() {
    let req = UpdateTaskRequest {
        title: Some("updated".into()),
        description: None,
        kind: None,
        completed: None,
        priority: None,
        is_pinned: None,
        due_date: None,
        start_date: None,
        project_id: None,
        tags: None,
        is_favorite: None,
    };
    assert_eq!(req.title, Some("updated".into()));
    assert!(req.description.is_none());
}

#[test]
fn test_api_response_ok() {
    let resp: ApiResponse<String> = ApiResponse::ok("hello".into());
    assert_eq!(resp.data, Some("hello".into()));
    assert!(resp.error.is_none());
    assert!(resp.success);
}

#[test]
fn test_api_response_err() {
    let resp: ApiResponse<()> = ApiResponse::err("something went wrong");
    assert!(resp.data.is_none());
    assert_eq!(resp.error, Some("something went wrong".into()));
    assert!(!resp.success);
}

#[test]
fn test_priority_from_str() {
    use std::str::FromStr;
    assert_eq!(Priority::from_str("none").unwrap(), Priority::None);
    assert_eq!(Priority::from_str("low").unwrap(), Priority::Low);
    assert_eq!(Priority::from_str("medium").unwrap(), Priority::Medium);
    assert_eq!(Priority::from_str("high").unwrap(), Priority::High);
    assert!(Priority::from_str("invalid").is_err());
}

#[test]
fn test_task_kind_from_str() {
    use std::str::FromStr;
    assert_eq!(TaskKind::from_str("task").unwrap(), TaskKind::Task);
    assert_eq!(TaskKind::from_str("note").unwrap(), TaskKind::Note);
    assert!(TaskKind::from_str("invalid").is_err());
}

#[test]
fn test_priority_as_str() {
    assert_eq!(Priority::None.as_str(), "none");
    assert_eq!(Priority::Low.as_str(), "low");
    assert_eq!(Priority::Medium.as_str(), "medium");
    assert_eq!(Priority::High.as_str(), "high");
}

#[test]
fn test_task_kind_as_str() {
    assert_eq!(TaskKind::Task.as_str(), "task");
    assert_eq!(TaskKind::Note.as_str(), "note");
}
