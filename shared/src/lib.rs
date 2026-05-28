use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ============================================================
// UTC → UTC+8 serde 转换模块
// 内部存储为 UTC，对外（JSON）读写为 UTC+8
// ============================================================
pub mod utc8 {
    use chrono::{DateTime, TimeDelta, Utc};
    use serde::{de, Deserialize, Deserializer, Serializer};

    const OFF: TimeDelta = match TimeDelta::try_hours(8) {
        Some(d) => d,
        None => unreachable!(),
    };

    fn fmt(dt: &DateTime<Utc>) -> String {
        (*dt + OFF).format("%Y-%m-%dT%H:%M:%S").to_string()
    }

    fn parse(s: &str) -> Result<DateTime<Utc>, String> {
        // 去掉时区后缀和时间毫秒
        let s = s.trim_end_matches('Z').trim_end_matches("+00:00");
        let s = match s.rfind('.') {
            Some(dot) if dot > 8 => &s[..dot], // 去除 .000 毫秒
            _ => s,
        };
        let naive = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
            .or_else(|_| chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M"))
            .or_else(|_| {
                chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                    .map(|d| d.and_hms_opt(0, 0, 0).unwrap())
            })
            .map_err(|e| e.to_string())?;
        Ok(naive.and_utc() - OFF)
    }

    // ---- DateTime<Utc> (非 Option) ----
    pub fn serialize<S>(dt: &DateTime<Utc>, s: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        s.serialize_str(&fmt(dt))
    }

    pub fn deserialize<'de, D>(d: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(d)?;
        parse(&s).map_err(de::Error::custom)
    }

    // ---- Option<DateTime<Utc>> ----
    pub fn serialize_opt<S>(dt: &Option<DateTime<Utc>>, s: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match dt {
            Some(dt) => s.serialize_str(&fmt(dt)),
            None => s.serialize_none(),
        }
    }

    pub fn deserialize_opt<'de, D>(d: D) -> Result<Option<DateTime<Utc>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt: Option<String> = Option::deserialize(d)?;
        match opt {
            Some(s) => parse(&s).map(Some).map_err(de::Error::custom),
            None => Ok(None),
        }
    }

    // ---- Option<Option<DateTime<Utc>>> (UpdateTaskRequest) ----
    pub fn serialize_optopt<S>(dt: &Option<Option<DateTime<Utc>>>, s: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match dt {
            Some(inner) => serialize_opt(inner, s),
            None => s.serialize_none(),
        }
    }

    pub fn deserialize_optopt<'de, D>(d: D) -> Result<Option<Option<DateTime<Utc>>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(Some(deserialize_opt(d)?))
    }
}

// 优先级
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    #[default]
    None,
    Low,
    Medium,
    High,
}

impl Priority {
    pub fn as_str(&self) -> &'static str {
        match self {
            Priority::None => "none",
            Priority::Low => "low",
            Priority::Medium => "medium",
            Priority::High => "high",
        }
    }
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "none" | "" => Some(Priority::None),
            "low" => Some(Priority::Low),
            "medium" => Some(Priority::Medium),
            "high" => Some(Priority::High),
            _ => None,
        }
    }
}

// 清单

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub kind: String,
    pub sort_order: i32,
    pub parent_id: Option<Uuid>,
    #[serde(
        serialize_with = "utc8::serialize",
        deserialize_with = "utc8::deserialize"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        serialize_with = "utc8::serialize",
        deserialize_with = "utc8::deserialize"
    )]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    #[serde(default)]
    pub id: Option<Uuid>,
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i32>,
    #[serde(default)]
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateProjectRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort_order: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<Option<Uuid>>,
}

// task

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum TaskKind {
    #[default]
    Task,
    Note,
}

impl TaskKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskKind::Task => "task",
            TaskKind::Note => "note",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "task" => Some(TaskKind::Task),
            "note" => Some(TaskKind::Note),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub kind: TaskKind,
    pub completed: bool,
    #[serde(
        serialize_with = "utc8::serialize_opt",
        deserialize_with = "utc8::deserialize_opt"
    )]
    pub completed_at: Option<DateTime<Utc>>,
    pub priority: Priority,
    #[serde(
        serialize_with = "utc8::serialize_opt",
        deserialize_with = "utc8::deserialize_opt"
    )]
    pub due_date: Option<DateTime<Utc>>,
    #[serde(
        serialize_with = "utc8::serialize_opt",
        deserialize_with = "utc8::deserialize_opt"
    )]
    pub start_date: Option<DateTime<Utc>>,
    pub project_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub tags: Vec<String>,
    pub sort_order: i32,
    pub is_pinned: bool,
    pub is_favorite: bool,
    #[serde(
        serialize_with = "utc8::serialize",
        deserialize_with = "utc8::deserialize"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        serialize_with = "utc8::serialize",
        deserialize_with = "utc8::deserialize"
    )]
    pub updated_at: DateTime<Utc>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    #[serde(default)]
    pub id: Option<Uuid>,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub kind: TaskKind,
    #[serde(default)]
    pub priority: Priority,
    #[serde(default)]
    pub is_pinned: bool,
    #[serde(
        default,
        serialize_with = "utc8::serialize_opt",
        deserialize_with = "utc8::deserialize_opt"
    )]
    pub due_date: Option<DateTime<Utc>>,
    #[serde(
        default,
        serialize_with = "utc8::serialize_opt",
        deserialize_with = "utc8::deserialize_opt"
    )]
    pub start_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub project_id: Option<Uuid>,
    #[serde(default)]
    pub parent_id: Option<Uuid>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateTaskRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<TaskKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_pinned: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        serialize_with = "utc8::serialize_optopt",
        deserialize_with = "utc8::deserialize_optopt"
    )]
    pub due_date: Option<Option<DateTime<Utc>>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        serialize_with = "utc8::serialize_optopt",
        deserialize_with = "utc8::deserialize_optopt"
    )]
    pub start_date: Option<Option<DateTime<Utc>>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<Option<Uuid>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_favorite: Option<bool>,
}

// tags

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: Uuid,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTagRequest {
    #[serde(default)]
    pub id: Option<Uuid>,
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateTagRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<Option<String>>,
}

// 筛选

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskFilter {
    pub project_id: Option<Uuid>,
    pub tag: Option<String>,
    pub priority: Option<Priority>,
    pub kind: Option<TaskKind>,
    pub completed: Option<bool>,
    pub due_today: Option<bool>,
    pub search: Option<String>,
}

// 用户 / 认证

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub role: String,
    pub avatar: Option<String>,
    #[serde(
        serialize_with = "utc8::serialize",
        deserialize_with = "utc8::deserialize"
    )]
    pub created_at: DateTime<Utc>,
}

/// 注册/登录：用户名 + RSA 加密后的密码（base64）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub encrypted_password: String,
}

/// 登录请求与注册相同
pub type LoginRequest = RegisterRequest;

/// 服务端返回的公钥（PEM 格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PubkeyResponse {
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

// api response

#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(msg.into()),
        }
    }
}
