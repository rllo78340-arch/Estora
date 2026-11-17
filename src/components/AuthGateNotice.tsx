import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

interface AuthGateNoticeProps {
  title: string;
  description: string;
}

export function AuthGateNotice({ title, description }: AuthGateNoticeProps) {
  const { signInWithGoogle, authError } = useAuth();
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-2xl rounded-[20px] border border-[#E5E4E0] bg-white p-10 text-center transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F3F1] text-[#143A30] dark:bg-[#242424] dark:text-[#D4B483]">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
        {description}
      </p>
      {authError && (
        <p className="mt-4 rounded-[12px] bg-[#FEF2F2] px-4 py-2.5 text-xs text-[#991B1B]">
          {authError}
        </p>
      )}
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[#143A30] px-6 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#0F2C24]"
      >
        {t.authGate.signInGoogle}
      </button>
    </div>
  );
}
