import assert from "node:assert"
import crypto from "node:crypto"

const algorithm = "aes-256-cbc"

export class EbbEncryption {
  private key: string
  private iv: Buffer

  constructor(secretKey?: string) {
    if (!secretKey) {
      throw new Error("warning: encryption secretKey is required")
    }
    this.key = crypto.createHash("sha512").update(secretKey).digest("hex").substring(0, 32)
    this.iv = crypto.randomBytes(16)
  }
  encrypt(data: string) {
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(this.key), this.iv)
    let encrypted = cipher.update(data, "utf-8", "hex")
    encrypted += cipher.final("hex")
  
    // Package the IV and encrypted data together so it can be stored in a single
    // column in the database.
    return this.iv.toString("hex") + encrypted
  }
  decrypt(data: string) {
    // Unpackage the combined iv + encrypted message. Since we are using a fixed
    // size IV, we can hard code the slice length.
    const inputIV = data.slice(0, 32)
    const encrypted = data.slice(32)
    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(this.key),
      Buffer.from(inputIV, "hex"),
    )
  
    let decrypted = decipher.update(encrypted, "hex", "utf-8")
    decrypted += decipher.final("utf-8")
    return decrypted
  }
}
