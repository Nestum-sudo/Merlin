import NextAuth from "next-auth";
import type { OAuthConfig } from "next-auth/providers";
import { query } from "./db";
import { storeStravaTokens, syncStravaForUser } from "./strava";

interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string; // URL do avatar
}

// O Strava não segue o padrão OpenID normal: não tem endpoint de userinfo
// separado, mas GET /api/v3/athlete com o access_token recém-obtido devolve
// o perfil — serve perfeitamente o mesmo papel.
const StravaProvider: OAuthConfig<StravaAthlete> = {
  id: "strava",
  name: "Strava",
  type: "oauth",
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
  authorization: {
    url: "https://www.strava.com/oauth/authorize",
    params: {
      scope: "read,activity:read_all",
      approval_prompt: "auto",
      response_type: "code",
    },
  },
  token: "https://www.strava.com/oauth/token",
  userinfo: "https://www.strava.com/api/v3/athlete",
  profile(athlete) {
    return {
      id: String(athlete.id),
      name: `${athlete.firstname} ${athlete.lastname}`.trim(),
      email: null, // o Strava não devolve email nos scopes que pedimos
      image: athlete.profile,
    };
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [StravaProvider],
  session: { strategy: "jwt" },
  pages: { signIn: "/onboarding" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // só corre no momento do login (account/profile só vêm preenchidos
      // nesse pedido) — nos pedidos seguintes o token já tem userId
      if (account && profile) {
        token.userId = await resolveInternalUser(profile.id as string, account);
      }
      return token;
    },
    async session({ session, token }) {
      (session as typeof session & { userId: string }).userId = token.userId as string;
      return session;
    },
  },
});

// Liga (ou cria) o utilizador interno a partir do athlete_id do Strava, e
// grava os tokens reais em connected_accounts — reaproveitando
// storeStravaTokens, que já sabia fazer isto para o fluxo antigo.
async function resolveInternalUser(
  stravaAthleteId: string,
  account: { access_token?: string; refresh_token?: string; expires_at?: number }
): Promise<string> {
  const [existing] = await query<{ user_id: string }>(
    `SELECT user_id FROM connected_accounts WHERE provider = 'strava' AND external_account_id = $1`,
    [stravaAthleteId]
  );

  let userId: string;
  let isNewUser = false;

  if (existing) {
    userId = existing.user_id;
  } else {
    isNewUser = true;
    // O Strava não dá email — usa-se um placeholder até o atleta definir
    // um real nas Definições (mesma decisão já tomada para o worker Garmin
    // e para o antigo /api/users, agora substituído por este fluxo).
    const placeholderEmail = `strava-${stravaAthleteId}@merlin.local`;
    const [created] = await query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Atleta') RETURNING id`,
      [placeholderEmail]
    );
    userId = created.id;
  }

  if (account.access_token && account.refresh_token && account.expires_at) {
    await storeStravaTokens(userId, {
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expires_at: account.expires_at,
    });
    await query(
      `UPDATE connected_accounts SET external_account_id = $2 WHERE user_id = $1 AND provider = 'strava'`,
      [userId, stravaAthleteId]
    );
  }

  if (isNewUser) {
    // não bloqueia o login à espera do sync — corre em segundo plano
    syncStravaForUser(userId).catch(() => {
      // falha aqui fica visível em connected_accounts.last_error, já
      // tratado dentro de syncStravaForUser/ensureValidAccessToken
    });
  }

  return userId;
}
