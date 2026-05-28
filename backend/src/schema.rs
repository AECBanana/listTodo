// @generated automatically by Diesel CLI.

diesel::table! {
    deleted_entities (entity_type, entity_id) {
        entity_type -> Text,
        entity_id -> Uuid,
        user_id -> Uuid,
        deleted_at -> Timestamptz,
    }
}

diesel::table! {
    projects (id) {
        id -> Uuid,
        user_id -> Uuid,
        name -> Text,
        color -> Text,
        kind -> Text,
        sort_order -> Int4,
        parent_id -> Nullable<Uuid>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    tags (id) {
        id -> Uuid,
        user_id -> Uuid,
        name -> Text,
        color -> Text,
    }
}

diesel::table! {
    tasks (id) {
        id -> Uuid,
        user_id -> Uuid,
        title -> Text,
        description -> Nullable<Text>,
        kind -> Text,
        completed -> Bool,
        completed_at -> Nullable<Timestamptz>,
        priority -> Text,
        is_pinned -> Bool,
        due_date -> Nullable<Timestamptz>,
        start_date -> Nullable<Timestamptz>,
        project_id -> Nullable<Uuid>,
        parent_id -> Nullable<Uuid>,
        tags -> Array<Nullable<Text>>,
        sort_order -> Int4,
        is_favorite -> Bool,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    users (id) {
        id -> Uuid,
        username -> Text,
        password_hash -> Text,
        role -> Text,
        avatar -> Nullable<Text>,
        created_at -> Timestamptz,
    }
}

diesel::joinable!(deleted_entities -> users (user_id));
diesel::joinable!(projects -> users (user_id));
diesel::joinable!(tags -> users (user_id));
diesel::joinable!(tasks -> projects (project_id));
diesel::joinable!(tasks -> users (user_id));

diesel::table! {
    server_settings (key) {
        key -> Text,
        value -> Text,
    }
}

diesel::table! {
    user_settings (user_id) {
        user_id -> Uuid,
        theme -> Text,
        primary_color -> Text,
        background_image -> Nullable<Text>,
        blur_amount -> Int4,
    }
}

diesel::joinable!(user_settings -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    projects,
    tags,
    tasks,
    users,
    server_settings,
    user_settings
);
