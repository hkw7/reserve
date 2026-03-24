# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # 開発サーバー起動 (http://localhost:3000)
npm run build        # プロダクションビルド
npm run lint         # ESLint
npm run db:migrate   # DBマイグレーション実行
npm run db:seed      # 管理者アカウントをDBに作成
npm run db:studio    # Prisma Studio (DB GUI)
```

## Architecture

Calendlyライクな個人予約システム。Next.js App Router でフロント・バックエンドを一体化。

| 画面 | 用途 |
|------|------|
| `/` | 一般ユーザー向け予約ページ |
| `/admin` | 管理者ログイン |
| `/admin/dashboard` | 空き時間設定・予約一覧 |

**APIルート**

| エンドポイント | 説明 | 認証 |
|---|---|---|
| `GET /api/availability` | 空き時間一覧 | 不要 |
| `POST /api/availability` | 空き時間追加 | 必要 |
| `DELETE /api/availability/[id]` | 空き時間削除（予約済みは不可） | 必要 |
| `GET /api/bookings` | 予約一覧 | 必要 |
| `POST /api/bookings` | 予約作成 | 不要 |
| `DELETE /api/bookings/[id]` | 予約キャンセル | 必要 |

**主要ファイル**

- `lib/prisma.ts` — PrismaClientシングルトン
- `lib/auth.ts` — NextAuth設定（CredentialsProvider）
- `lib/email.ts` — Nodemailerによるメール送信（予約確認・管理者通知）
- `prisma/schema.prisma` — DBスキーマ（Availability, Booking, Admin）
- `prisma/seed.ts` — 管理者初期データ作成スクリプト

## Environment Variables (.env)

```
DATABASE_URL          # SQLiteファイルパス（例: file:./dev.db）
NEXTAUTH_SECRET       # JWT署名キー
NEXTAUTH_URL          # アプリURL
ADMIN_EMAIL           # 管理者メールアドレス（シード用・通知送信先）
ADMIN_PASSWORD        # 管理者初期パスワード（シード用）
EMAIL_HOST/PORT/USER/PASS/FROM  # SMTP設定
```

## Key Behaviors

- **Prisma v5** を使用（v7は破壊的変更があるためダウングレード済み）
- 予約作成時は `Booking` 作成と `Availability.isBooked=true` を `$transaction` で原子的に更新
- メール送信失敗は予約処理を止めない（try/catchで握りつぶす）
- Next.js 15+ の動的ルートでは `params` が `Promise<{...}>` なので `await params` が必要
