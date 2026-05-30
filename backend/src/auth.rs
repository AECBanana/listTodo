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
            if cfg!(debug_assertions) {
                tracing::warn!("[!] 未设置 JWT_SECRET，使用开发密钥");
                "dev-do-not-use-in-production-xxxxxxxx".into()
            } else {
                panic!("JWT_SECRET must be set in production");
            }
        });
        if s.len() < 16 {
            if cfg!(debug_assertions) {
                tracing::warn!("[!] JWT_SECRET 太短或不安全，请在生产环境中更换");
            } else {
                panic!("JWT_SECRET must be at least 16 characters in production");
            }
        }
        s
    });
    &SECRET
}

pub fn create_token(user_id: Uuid, username: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(1))
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

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_jwt_secret_default_in_debug() {
        let saved = std::env::var("JWT_SECRET").ok();
        std::env::remove_var("JWT_SECRET");
        let result = std::panic::catch_unwind(|| {
            jwt_secret();
        });
        // Restore env
        if let Some(val) = saved {
            std::env::set_var("JWT_SECRET", val);
        }
        if cfg!(debug_assertions) {
            assert!(result.is_ok());
        }
    }

    #[test]
    fn test_jwt_secret_from_env() {
        std::env::set_var("JWT_SECRET", "my-test-secret-key-at-least-16-chars");
        let secret = jwt_secret();
        assert!(secret.len() >= 16);
    }

    #[test]
    fn test_create_and_verify_token() {
        std::env::set_var("JWT_SECRET", "test-jwt-secret-for-unit-tests!!");
        let user_id = Uuid::new_v4();
        let username = "testuser";

        let token = create_token(user_id, username).expect("token creation failed");
        assert!(!token.is_empty());

        let claims = verify_token(&token).expect("token verification failed");
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.username, username);
    }

    #[test]
    fn test_verify_invalid_token() {
        std::env::set_var("JWT_SECRET", "test-jwt-secret-for-unit-tests!!");
        let result = verify_token("invalid.token.here");
        assert!(result.is_err());
    }

    #[test]
    fn test_claims_serialization() {
        let claims = Claims {
            sub: Uuid::nil(),
            username: "test".into(),
            exp: 9999999999,
        };
        let json = serde_json::to_string(&claims).unwrap();
        let parsed: Claims = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.sub, Uuid::nil());
        assert_eq!(parsed.username, "test");
        assert_eq!(parsed.exp, 9999999999);
    }
}
