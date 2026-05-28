use rand::rngs::OsRng;
use rsa::pkcs8::DecodePublicKey;
use rsa::{Pkcs1v15Encrypt, RsaPublicKey};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        eprintln!("用法: encrypt <公钥PEM文件> <明文密码>");
        return;
    }

    let pem = std::fs::read_to_string(&args[1]).expect("无法读取公钥文件");
    let pubkey = RsaPublicKey::from_public_key_pem(&pem).expect("公钥格式错误");

    let mut rng = OsRng;
    let ciphertext = pubkey
        .encrypt(&mut rng, Pkcs1v15Encrypt, args[2].as_bytes())
        .expect("加密失败");

    println!(
        "{}",
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &ciphertext)
    );
}
