/**
 * Capacitor platform tests
 *
 * Tests the Capacitor platform stub implementation
 */

import { describe, it, expect } from "vitest";
import { CapacitorSqliteDatabase } from "../capacitor/capacitor-database.js";
import { CapacitorFileSystem } from "../capacitor/capacitor-filesystem.js";
import { createCapacitorPlatform } from "../capacitor/capacitor-platform.js";
import { BrowserFetch } from "../browser/browser-http.js";
import { DatabaseDriverError, FileSystemError } from "../contracts/errors.js";

describe("Capacitor Platform", () => {
  it("should create a valid capacitor platform", () => {
    const platform = createCapacitorPlatform();

    expect(platform.type).toBe("capacitor");
    expect(platform.database).toBeInstanceOf(CapacitorSqliteDatabase);
    expect(platform.http).toBeInstanceOf(BrowserFetch);
    expect(platform.filesystem).toBeInstanceOf(CapacitorFileSystem);
  });

  it("should create capacitor platform with custom HTTP options", () => {
    const platform = createCapacitorPlatform({
      http: {
        maxRetries: 1,
      },
    });

    expect(platform.type).toBe("capacitor");
  });
});

describe("Capacitor Database Stub", () => {
  let db: CapacitorSqliteDatabase;

  beforeEach(() => {
    db = new CapacitorSqliteDatabase();
  });

  it("should throw on init()", async () => {
    await expect(db.init()).rejects.toThrow(DatabaseDriverError);
    await expect(db.init()).rejects.toThrow("not yet implemented");
  });

  it("should throw on close()", async () => {
    await expect(db.close()).rejects.toThrow(DatabaseDriverError);
  });

  it("should throw on query()", async () => {
    await expect(db.query("SELECT 1")).rejects.toThrow(DatabaseDriverError);
  });

  it("should throw on exec()", async () => {
    await expect(db.exec("INSERT INTO test VALUES (1)")).rejects.toThrow(
      DatabaseDriverError
    );
  });

  it("should throw on execScript()", async () => {
    await expect(db.execScript("CREATE TABLE test (id INTEGER)")).rejects.toThrow(
      DatabaseDriverError
    );
  });

  it("should throw on transaction()", async () => {
    await expect(db.transaction(async () => {})).rejects.toThrow(
      DatabaseDriverError
    );
  });
});

describe("Capacitor FileSystem Stub", () => {
  let fs: CapacitorFileSystem;

  beforeEach(() => {
    fs = new CapacitorFileSystem();
  });

  it("should throw on pickImages()", async () => {
    await expect(fs.pickImages()).rejects.toThrow(FileSystemError);
    await expect(fs.pickImages()).rejects.toThrow("not yet implemented");
  });

  it("should throw on saveAttachment()", async () => {
    await expect(
      fs.saveAttachment("id", "chatId", "file.png", "image/png", "data")
    ).rejects.toThrow(FileSystemError);
  });

  it("should throw on loadAttachment()", async () => {
    await expect(fs.loadAttachment("path")).rejects.toThrow(FileSystemError);
  });

  it("should throw on deleteAttachment()", async () => {
    await expect(fs.deleteAttachment("path")).rejects.toThrow(FileSystemError);
  });

  it("should throw on deleteAttachmentsForChat()", async () => {
    await expect(fs.deleteAttachmentsForChat("chatId")).rejects.toThrow(
      FileSystemError
    );
  });
});
