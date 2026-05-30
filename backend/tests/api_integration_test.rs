use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rand::rngs::OsRng;
use rsa::{pkcs8::DecodePublicKey, Pkcs1v15Encrypt, RsaPublicKey};
use serde_json::{json, Value};

const BASE_URL: &str = "http://127.0.0.1:3000";

fn encrypt_password(public_key_pem: &str, password: &str) -> String {
    let pub_key = RsaPublicKey::from_public_key_pem(public_key_pem).unwrap();
    let mut rng = OsRng;
    let encrypted = pub_key
        .encrypt(&mut rng, Pkcs1v15Encrypt, password.as_bytes())
        .unwrap();
    BASE64.encode(&encrypted)
}

#[tokio::test]
async fn test_full_auth_flow() {
    let client = reqwest::Client::new();

    // 1. Get public key
    let resp = client
        .get(format!("{}/api/auth/pubkey", BASE_URL))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.unwrap();
    let pubkey = body["data"]["public_key"].as_str().unwrap();
    assert!(pubkey.contains("PUBLIC KEY"));

    // 2. Register
    let enc_pass = encrypt_password(pubkey, "test123456");
    let resp = client
        .post(format!("{}/api/auth/register", BASE_URL))
        .json(&json!({"username": "api_test_user", "encrypted_password": enc_pass}))
        .send()
        .await
        .unwrap();
    // 400 = user already exists (from previous test run), 200 = new user registered — either is OK
    assert!(resp.status().is_success() || resp.status().as_u16() == 400);

    // 3. Login
    let enc_pass2 = encrypt_password(pubkey, "test123456");
    let resp = client
        .post(format!("{}/api/auth/login", BASE_URL))
        .json(&json!({"username": "api_test_user", "encrypted_password": enc_pass2}))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.unwrap();
    let token = body["data"]["token"].as_str().unwrap();
    assert!(!token.is_empty());
    println!("Login successful, token received");

    // 4. Access protected endpoint (user settings)
    let resp = client
        .get(format!("{}/api/user", BASE_URL))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.unwrap();
    assert!(body["success"].as_bool().unwrap());
    // User endpoint returns settings (theme, primary_color, etc.)
    assert!(body["data"]["theme"].is_string());

    // 5. Access without token - should fail
    let resp = client
        .get(format!("{}/api/user", BASE_URL))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 401);
}

#[test]
fn test_validation_errors() {
    // Run with tokio runtime
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let client = reqwest::Client::new();

        // Empty username
        let resp = client
            .post(format!("{}/api/auth/register", BASE_URL))
            .json(&json!({"username": "", "encrypted_password": "x"}))
            .send()
            .await
            .unwrap();
        assert_eq!(resp.status(), 400);

        // Missing required field
        let resp = client
            .post(format!("{}/api/auth/register", BASE_URL))
            .json(&json!({"username": "u"}))
            .send()
            .await
            .unwrap();
        assert_eq!(resp.status(), 422);
    });
}

#[tokio::test]
async fn test_sync_endpoint() {
    let client = reqwest::Client::new();

    // Login first
    let resp = client
        .get(format!("{}/api/auth/pubkey", BASE_URL))
        .send()
        .await
        .unwrap();
    let body: Value = resp.json().await.unwrap();
    let pubkey = body["data"]["public_key"].as_str().unwrap();
    let enc_pass = encrypt_password(pubkey, "test123456");

    let resp = client
        .post(format!("{}/api/auth/login", BASE_URL))
        .json(&json!({"username": "api_test_user", "encrypted_password": enc_pass}))
        .send()
        .await
        .unwrap();
    let token = resp.json::<Value>().await.unwrap()["data"]["token"]
        .as_str()
        .unwrap()
        .to_string();

    // Test sync pull
    let resp = client
        .get(format!(
            "{}/api/sync/pull?since=2026-01-01T00:00:00Z",
            BASE_URL
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.unwrap();
    assert!(body["success"].as_bool().unwrap());
    println!("Sync response: {}", body);
}
