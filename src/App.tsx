import { Route, Routes } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { HomePage } from "./pages/HomePage";
import { ShopPage } from "./pages/ShopPage";
import { ProductPage } from "./pages/ProductPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { LookbookPage } from "./pages/LookbookPage";
import { AboutPage } from "./pages/AboutPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ClientCarePage } from "./pages/ClientCarePage";
import { BridalPage } from "./pages/BridalPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PrivacyPage, ReturnsPage, ShippingPage } from "./pages/LegalPage";
import { AdminPage } from "./admin/AdminPage";

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/sekanae-studio") || location.pathname.startsWith("/admin");

  return (
    <>
      {!isAdmin && <Header />}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/lookbook" element={<LookbookPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/client-care" element={<ClientCarePage />} />
          <Route path="/bridal" element={<BridalPage />} />
          <Route path="/shipping" element={<ShippingPage />} />
          <Route path="/returns" element={<ReturnsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="/sekanae-studio/*" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
    </>
  );
}
