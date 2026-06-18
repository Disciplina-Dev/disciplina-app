import { createBrowserRouter } from "react-router-dom";

import NotFound from "@/pages/NotFound";
import GoogleAuthCallback from "@/pages/GoogleAuthCallback";
import PublicBooking from "@/pages/booking/PublicBooking";

import AuthLayout from "@/components/layout/AuthLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

import CommercialLayout from "@/components/layout/CommercialLayout";
import DashboardCommercial from "@/pages/commercial/DashboardCommercial";
import ListeAB from "@/pages/commercial/ListeAB";
import CreateAB from "@/pages/commercial/CreateAB";
import PortefeuilleEntreprises from "@/pages/commercial/PortefeuilleEntreprises";
import EntreprisePage from "@/pages/commercial/EntreprisePage";
import Sourcing from "@/pages/commercial/sourcing";
import RelanceCommercial from "@/pages/commercial/RelanceCommercial";
import ListeNoire from "@/pages/commercial/ListeNoire";

import RHLayout from "@/components/layout/RHLayout";
import DashboardRH from "@/pages/rh/DashboardRH";
import ListeCandidats from "@/pages/rh/ListeCandidats";
import FicheCandidat from "@/pages/rh/FicheCandidat";
import QuestionnaireAB from "@/pages/rh/QuestionnaireAB";
import Matching from "@/pages/rh/Matching";
import Calendrier from "@/pages/rh/Calendrier";
import ABEntreprisesRecues from "@/pages/rh/ABEntreprisesRecues";
import MailTemplates from "@/pages/rh/MailTemplates";
import Relance from "@/pages/rh/Relance";

import EntrepriseLayout from "@/components/layout/EntrepriseLayout";
import DashboardEntreprise from "@/pages/entreprise/DashboardEntreprise";
import FormulaireAB from "@/pages/entreprise/FormulaireAB";
import GestionApprentis from "@/pages/entreprise/GestionApprentis";
import GestionRDV from "@/pages/entreprise/GestionRDV";
import ProfilsMatches from "@/pages/entreprise/ProfilsMatches";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { UserRole } from "@/store/authStore";

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
  {
    path: "/", element: <LoginPage /> },
  {
    path: "/auth/google", element: <GoogleAuthCallback /> },
      {
        path: "/register",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <RegisterPage />
          </ProtectedRoute>
        )
      },
    ],
  },
  {
    path: "/commercial",
    element: (
      <ProtectedRoute allowedRoles={[UserRole.COMMERCIAL]}>
        <CommercialLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardCommercial /> },
      { path: "analyses-besoin", element: <ListeAB /> },
      { path: "analyses-besoin/nouvelle", element: <CreateAB /> },
      { path: "portefeuille", element: <PortefeuilleEntreprises /> },
      { path: "portefeuille/:slug", element: <EntreprisePage /> },
      { path: "liste-noire", element: <ListeNoire /> },
      { path: "sourcing", element: <Sourcing /> },
      { path: "mail", element: <MailTemplates scope="commercial" /> },
      { path: "relance", element: <RelanceCommercial /> },
    ],
  },
  {
    path: "/rh",
    element: (
      <ProtectedRoute allowedRoles={[UserRole.RH]}>
        <RHLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardRH /> },
      { path: "candidats", element: <ListeCandidats /> },
      { path: "candidats/:id", element: <FicheCandidat /> },
      { path: "candidats/:id/questionnaire", element: <QuestionnaireAB /> },
      { path: "matching", element: <Matching /> },
      { path: "calendrier", element: <Calendrier /> },
      { path: "analyses-besoin", element: <ABEntreprisesRecues /> },
      { path: "mail", element: <MailTemplates scope="rh" /> },
      { path: "relance", element: <Relance /> },
    ],
  },
  {
    path: "/entreprise",
    element: (
      <ProtectedRoute allowedRoles={[UserRole.ENTREPRISE]}>
        <EntrepriseLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardEntreprise /> },
      { path: "analyse-besoin", element: <FormulaireAB /> },
      { path: "apprentis", element: <GestionApprentis /> },
      { path: "rendez-vous", element: <GestionRDV /> },
      { path: "profils", element: <ProfilsMatches /> },
    ],
  },
  {
    path: "/booking/:slug",
    element: <PublicBooking />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
