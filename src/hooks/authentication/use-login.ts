import { Login } from '@/auth-client';
import { postAuthByClientV1AuthLoginMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

type Tokens = {
  access_token: string;
  refresh_token: string;
};

export function useLogin() {
  const loginMutation = useMutation({
    ...postAuthByClientV1AuthLoginMutation(),
  });

  const login = async (data: Login) => {
    const loginData = await loginMutation.mutateAsync({
      path: {
        client: 'app',
      },
      body: data,
    });

    // generated types are wrong, it's too hard to fix them, so we cast it
    const tokens = loginData.meta.access_token as unknown as Tokens;
    if (loginData.data?.user?.id) {
      localStorage.setItem('uid', loginData.data?.user?.id);
    }
    localStorage.setItem('accessToken', tokens.access_token);
    localStorage.setItem('refreshToken', tokens.refresh_token);

    return loginData;
  };

  return {
    login,
    loginMutation,
  };
}
