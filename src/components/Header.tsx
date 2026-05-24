import { ChevronDown, Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { currencies, type CurrencyCode } from "../data/catalog";
import { useStore } from "../context/StoreContext";

const navItems = [
  { label: "Shop", path: "/shop" },
  { label: "Collections", path: "/collections" },
  { label: "Gifting", path: "/shop?category=Gift%20Shop" },
  { label: "Discover", path: "/lookbook" },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const { currency, setCurrency, cartCount, wishlist, customerAccount, openAccountPrompt, signOutCustomer } = useStore();
  const location = useLocation();

  function isActiveNavItem(path: string) {
    const [targetPath, targetSearch] = path.split("?");
    if (location.pathname !== targetPath) {
      return false;
    }

    const currentParams = new URLSearchParams(location.search);
    const targetParams = new URLSearchParams(targetSearch ?? "");

    if (targetParams.size > 0) {
      return Array.from(targetParams.entries()).every(
        ([key, value]) => currentParams.get(key) === value
      );
    }

    if (targetPath === "/shop") {
      return currentParams.get("category") !== "Gift Shop";
    }

    return true;
  }

  return (
    <>
      <header className="site-header">
        <nav className="nav-shell" aria-label="Primary navigation">
          <button
            className="icon-button menu-button"
            type="button"
            aria-label="Open navigation"
            onClick={() => setIsOpen(true)}
          >
            <Menu size={20} />
          </button>

          <Link to="/" className="brand-mark" aria-label="SEKANAE home">
            SEKANAE
          </Link>

          <div className="desktop-nav">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className={isActiveNavItem(item.path) ? "active" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="nav-actions">
            <button className="icon-button" type="button" aria-label="Search">
              <Search size={18} />
            </button>
            <div className="currency-picker">
              <button
                type="button"
                aria-label="Select currency"
                aria-expanded={isCurrencyOpen}
                aria-haspopup="listbox"
                onClick={() => setIsCurrencyOpen((open) => !open)}
              >
                <span>{currency}</span>
                <ChevronDown size={14} />
              </button>
              {isCurrencyOpen && (
                <div className="currency-menu" role="listbox" aria-label="Currency options">
                  {Object.entries(currencies).map(([code, meta]) => (
                    <button
                      key={code}
                      type="button"
                      role="option"
                      aria-selected={currency === code}
                      onClick={() => {
                        setCurrency(code as CurrencyCode);
                        setIsCurrencyOpen(false);
                      }}
                    >
                      <span>{meta.label}</span>
                      <small>{meta.symbol}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="icon-button count-button"
              type="button"
              aria-label="Wishlist"
              onClick={() => {
                if (!customerAccount) {
                  openAccountPrompt("Create an account to save and view your wishlist.");
                  return;
                }
              }}
            >
              <Heart size={18} />
              <span>{wishlist.length}</span>
            </button>
            <Link className="icon-button count-button" to="/cart" aria-label="Cart">
              <ShoppingBag size={18} />
              <span>{cartCount}</span>
            </Link>
            <button
              className="icon-button account-button"
              type="button"
              aria-label={customerAccount ? "Sign out of account" : "Create account"}
              title={customerAccount ? `Signed in as ${customerAccount.email}` : "Create account"}
              onClick={() => {
                if (customerAccount) {
                  signOutCustomer();
                  return;
                }

                openAccountPrompt("Create an account to save your wishlist and continue checkout.");
              }}
            >
              <User size={18} />
            </button>
          </div>
        </nav>
      </header>

      {isOpen && (
        <div className="mobile-menu-layer">
          <button
            className="mobile-menu-backdrop"
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsOpen(false)}
          />
          <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div className="drawer-top">
              <span className="brand-mark">SEKANAE</span>
              <button
                className="icon-button"
                type="button"
                aria-label="Close navigation"
                onClick={() => setIsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="drawer-links">
              {navItems.map((item) => (
                <Link key={item.label} to={item.path} onClick={() => setIsOpen(false)}>
                  {item.label}
                </Link>
              ))}
              <Link to="/about" onClick={() => setIsOpen(false)}>
                About
              </Link>
              <Link to="/bridal" onClick={() => setIsOpen(false)}>
                Bridal Atelier
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (customerAccount) {
                    signOutCustomer();
                    return;
                  }
                  openAccountPrompt("Create an account to save your wishlist and continue checkout.");
                }}
              >
                {customerAccount ? "Sign out" : "Create account"}
              </button>
            </div>
            <div className="drawer-note">
              <p>Designed for every destination.</p>
              <Link to="/client-care" onClick={() => setIsOpen(false)}>
                Client Care
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
