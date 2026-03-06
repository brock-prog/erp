import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react';
import type { CustomerPortalSession } from '../types/portal';
import { PORTAL_ACCOUNTS } from '../data/portalData';

// ─── State ────────────────────────────────────────────────────────────────────

interface CustomerPortalState {
  session: CustomerPortalSession | null;
}

type CustomerPortalAction =
  | { type: 'LOGIN'; payload: CustomerPortalSession }
  | { type: 'LOGOUT' };

// ─── Context ──────────────────────────────────────────────────────────────────

interface CustomerPortalContextValue {
  portalState: CustomerPortalState;
  portalLogin: (email: string, password: string) => { ok: boolean; error?: string };
  portalLogout: () => void;
}

const CustomerPortalContext = createContext<CustomerPortalContextValue | null>(null);

// ─── Reducer ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'decora_portal_session';

function reducer(
  state: CustomerPortalState,
  action: CustomerPortalAction
): CustomerPortalState {
  switch (action.type) {
    case 'LOGIN':
      return { session: action.payload };
    case 'LOGOUT':
      return { session: null };
    default:
      return state;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CustomerPortalProvider({ children }: { children: ReactNode }) {
  const saved = (() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CustomerPortalSession) : null;
    } catch {
      return null;
    }
  })();

  const [portalState, dispatch] = useReducer(reducer, { session: saved });

  // Persist session to sessionStorage (clears when tab/window closes)
  useEffect(() => {
    if (portalState.session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(portalState.session));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [portalState.session]);

  const portalLogin = (email: string, password: string): { ok: boolean; error?: string } => {
    const account = PORTAL_ACCOUNTS.find(
      a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );
    if (!account) return { ok: false, error: 'Invalid email or password.' };
    if (!account.isActive) return { ok: false, error: 'Your account has been deactivated. Please contact us.' };

    const session: CustomerPortalSession = {
      accountId:   account.id,
      customerId:  account.customerId,
      companyName: account.companyName,
      contactName: account.contactName,
      email:       account.email,
    };
    dispatch({ type: 'LOGIN', payload: session });
    return { ok: true };
  };

  const portalLogout = () => dispatch({ type: 'LOGOUT' });

  return (
    <CustomerPortalContext.Provider value={{ portalState, portalLogin, portalLogout }}>
      {children}
    </CustomerPortalContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCustomerPortal(): CustomerPortalContextValue {
  const ctx = useContext(CustomerPortalContext);
  if (!ctx) throw new Error('useCustomerPortal must be used inside CustomerPortalProvider');
  return ctx;
}
