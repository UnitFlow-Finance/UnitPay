import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile } from "@/lib/platform/store";
import { defaultSupportedTokens, normalizeCustomToken, type SupportedToken } from "@/lib/platform/tokens";

interface TokensDatabase {
  customTokens: SupportedToken[];
}

const TOKENS_FILE = "tokens.json";
const emptyDb: TokensDatabase = { customTokens: [] };

export async function GET() {
  const db = await readJsonFile(TOKENS_FILE, emptyDb);
  return NextResponse.json({ tokens: [...defaultSupportedTokens(), ...db.customTokens] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = normalizeCustomToken({
      chainKey: String(body.chainKey),
      contractAddress: String(body.contractAddress),
      name: body.name ? String(body.name) : undefined,
      symbol: body.symbol ? String(body.symbol) : undefined,
      decimals: body.decimals ? Number(body.decimals) : undefined,
      logoUrl: body.logoUrl ? String(body.logoUrl) : undefined,
    });
    await updateJsonFile(TOKENS_FILE, emptyDb, (db) => {
      db.customTokens = db.customTokens.filter((entry) => entry.id !== token.id);
      db.customTokens.unshift(token);
    });
    return NextResponse.json({ token }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
