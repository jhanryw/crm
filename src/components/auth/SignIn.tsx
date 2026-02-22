'use client';

type Props = {
  onSignIn: () => Promise<void>;
  className?: string;
};

const SignIn = ({ onSignIn, className }: Props) => {
  return (
    <button
      className={className}
      onClick={() => {
        onSignIn();
      }}
    >
      Entrar com Logto
    </button>
  );
};


export default SignIn;