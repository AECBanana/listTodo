use rand::rngs::OsRng;
use rsa::pkcs8::EncodePrivateKey;
use rsa::RsaPrivateKey;

fn main() {
    let mut rng = OsRng;
    let private_key = RsaPrivateKey::new(&mut rng, 2048).expect("生成密钥失败");

    let priv_pem = private_key
        .to_pkcs8_pem(rsa::pkcs8::LineEnding::LF)
        .expect("导出私钥失败")
        .to_string();

    // base64 编码后存一行
    let encoded = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        priv_pem.as_bytes(),
    );
    println!("RSA_PRIVATE_KEY={}", encoded);
}
