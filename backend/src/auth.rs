use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Validation};
use rsa::pkcs8::DecodePrivateKey;
use rsa::{Pkcs1v15Encrypt, RsaPrivateKey};
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use uuid::Uuid;

// ── JWT ──────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub username: String,
    pub exp: usize,
}

fn jwt_secret() -> &'static str {
    static SECRET: LazyLock<String> = LazyLock::new(|| {
        let s = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
            tracing::warn!("JWT_SECRET 未设置，使用默认密钥（仅开发环境安全）");
            "dev-secret-change-me".into()
        });
        if s == "dev-secret-change-me" || s.len() < 16 {
            tracing::warn!("JWT_SECRET 太短或不安全，请在生产环境中更换");
        }
        s
    });
    &SECRET
}

pub fn create_token(user_id: Uuid, username: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id,
        username: username.to_string(),
        exp,
    };

    let header = jsonwebtoken::Header {
        alg: jsonwebtoken::Algorithm::HS256,
        ..Default::default()
    };

    encode(
        &header,
        &claims,
        &EncodingKey::from_secret(jwt_secret().as_bytes()),
    )
}

pub fn verify_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.validate_exp = true;
    validation.required_spec_claims.clear(); // 不强制 aud/iss，但固定算法

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_bytes()),
        &validation,
    )
    .map(|d| d.claims)
}

// ── RSA ──────────────────────────────────

static RSA_KEY: LazyLock<Option<RsaPrivateKey>> = LazyLock::new(|| {
    let encoded = match std::env::var("RSA_PRIVATE_KEY") {
        Ok(v) if !v.is_empty() => v,
        _ => {
            tracing::warn!("RSA_PRIVATE_KEY 未设置，密码加密功能不可用");
            return None;
        }
    };
    let pem_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encoded)
        .expect("RSA_PRIVATE_KEY base64 解码失败");
    let pem = String::from_utf8(pem_bytes).expect("RSA_PRIVATE_KEY UTF-8 解码失败");
    Some(RsaPrivateKey::from_pkcs8_pem(&pem).expect("RSA_PRIVATE_KEY 格式错误"))
});

fn get_key() -> Result<&'static RsaPrivateKey, String> {
    RSA_KEY
        .as_ref()
        .ok_or_else(|| "RSA 密钥未配置，无法加密".into())
}

/// 返回公钥 PEM（前端用它加密密码）
pub fn get_public_key_pem() -> String {
    use rsa::pkcs8::EncodePublicKey;
    let key = get_key().expect("RSA key not available");
    key.to_public_key()
        .to_public_key_pem(rsa::pkcs8::LineEnding::LF)
        .expect("导出公钥失败")
}

/// 用私钥解密前端传来的密文（base64 编码），返回明文密码
pub fn decrypt_password(encrypted_b64: &str) -> Result<String, String> {
    let key = get_key()?;
    let ciphertext =
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encrypted_b64)
            .map_err(|_| "密文解码失败".to_string())?;

    key.decrypt(Pkcs1v15Encrypt, &ciphertext)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .map_err(|_| "解密失败，公钥不匹配".to_string())
}
