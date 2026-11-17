import { useI18n } from '../context/I18nContext';
import { PRIMARY_NAV_ITEMS, WORKSPACE_NAV_ITEMS } from '../utils/routes';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[#E5E4E0] bg-white transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/');
              }}
              className="font-display text-2xl font-semibold tracking-tight text-[#171717] dark:text-[#F5F5F5]"
            >
              ESTORA
            </a>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
              {t.footer.tagline}
            </p>
            <p className="mt-4 text-xs text-[#737373] dark:text-[#A0A0A0]">
              {t.footer.regionsLine}
            </p>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
              {t.footer.realEstateHeading}
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/');
                  }}
                  className="text-sm text-[#525252] hover:text-[#171717] hover:underline underline-offset-4 dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]"
                >
                  {t.nav.home}
                </a>
              </li>
              {PRIMARY_NAV_ITEMS.map((item) => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(item.path);
                    }}
                    className="text-sm text-[#525252] hover:text-[#171717] hover:underline underline-offset-4 dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]"
                  >
                    {t.nav[item.key]}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <h3 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
              {t.footer.accountHeading}
            </h3>
            <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {WORKSPACE_NAV_ITEMS.map((item) => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(item.path);
                    }}
                    className="text-sm text-[#525252] hover:text-[#171717] hover:underline underline-offset-4 dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]"
                  >
                    {t.nav[item.key]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-[#E5E4E0] pt-6 text-xs text-[#737373] sm:flex-row sm:items-center dark:border-[#2C2C2C] dark:text-[#A0A0A0]">
          <span>{t.footer.copyright}</span>
          <span>{t.footer.bottomTagline}</span>
        </div>
      </div>
    </footer>
  );
}
