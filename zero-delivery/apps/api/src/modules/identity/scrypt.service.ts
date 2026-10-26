import { Injectable } from "@nestjs/common";
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

@Injectable()
export class ScryptService {
  private readonly N = 16384;
  private readonly r = 8;
  private readonly p = 1;
  private readonly keylen = 64;

  /**
   * Genera un hash criptográfico de la contraseña usando scrypt.
   * Formato de salida: scrypt$N=16384,r=8,p=1$hex_salt$hex_hash
   */
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = await this.deriveKey(password, salt, this.keylen);
    return `scrypt$N=${this.N},r=${this.r},p=${this.p}$${salt}$${derivedKey.toString("hex")}`;
  }

  /**
   * Verifica si la contraseña coincide con el hash almacenado utilizando comparación de tiempo constante.
   */
  async verify(password: string, storedHash: string): Promise<boolean> {
    try {
      const parts = storedHash.split("$");
      if (parts.length !== 4 || parts[0] !== "scrypt") {
        return false;
      }

      const salt = parts[2] ?? "";
      const expectedHash = parts[3] ?? "";
      const expectedBuffer = Buffer.from(expectedHash, "hex");

      const derivedKey = await this.deriveKey(password, salt, expectedBuffer.length);

      if (derivedKey.length !== expectedBuffer.length) {
        return false;
      }

      return timingSafeEqual(derivedKey, expectedBuffer);
    } catch {
      return false;
    }
  }

  private deriveKey(password: string, salt: string, keylen: number): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        salt,
        keylen,
        { N: this.N, r: this.r, p: this.p, maxmem: 64 * 1024 * 1024 },
        (err, key) => {
          if (err) reject(err);
          else resolve(key as Buffer);
        }
      );
    });
  }
}
