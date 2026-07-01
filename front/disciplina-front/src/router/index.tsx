import { createBrowserRouter, Navigate } from "react-router-dom";

import NotFound from "@/pages/NotFound";
import GoogleAuthCallback from "@/pages/GoogleAuthCallback";
import PublicBooking from "@/pages/booking/PublicBooking";
import MatchGate from "@/pages/publicMatch/MatchGate";
import MatchComparator from "@/pages/publicMatch/MatchComparator";
import InterviewGate from "@/pages/publicInterview/InterviewGate";
import InterviewSlotPicker from "@/pages/publicInterview/InterviewSlotPicker";

import AuthLayout from "@/components/layout/AuthLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminLayout from "@/components/layout/AdminLayout";

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
import DriveConfig from "@/pages/rh/DriveConfig";
import SectorSettings from "@/pages/rh/SectorSettings";

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
      // Redirections rétro-compatibles vers le nouvel espace admin
      { path: "/register", element: <Navigate to="/admin/utilisateurs/nouveau" replace /> },
      { path: "/utilisateurs", element: <Navigate to="/admin/utilisateurs" replace /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    handle: { crumb: "Administration" },
    children: [
      { index: true, element: <Navigate to="utilisateurs" replace /> },
      { path: "utilisateurs", element: <AdminUsers />, handle: { crumb: "Utilisateurs" } },
      { path: "utilisateurs/nouveau", element: <RegisterPage />, handle: { crumb: "Créer un utilisateur" } },
    ],
  },
  {
    path: "/commercial",
    element: (
      <ProtectedRoute allowedRoles={[UserRole.COMMERCIAL]}>
        <CommercialLayout />
      </ProtectedRoute>
    ),
    handle: { crumb: "Commercial" },
    children: [
      { index: true, element: <DashboardCommercial />, handle: { crumb: "Tableau de bord" } },
      { path: "analyses-besoin", element: <ListeAB />, handle: { crumb: "Analyses de besoin" } },
      { path: "analyses-besoin/nouvelle", element: <CreateAB />, handle: { crumb: "Nouvelle analyse" } },
      { path: "portefeuille", element: <PortefeuilleEntreprises />, handle: { crumb: "Portefeuille" } },
      {
        path: "portefeuille/:slug",
        element: <EntreprisePage />,
        handle: {
          crumb: ({ params }: { params: Record<string, string | undefined> }) =>
            params.slug ? decodeURIComponent(params.slug) : "Entreprise",
        },
      },
      { path: "liste-noire", element: <ListeNoire />, handle: { crumb: "Liste noire" } },
      { path: "sourcing", element: <Sourcing />, handle: { crumb: "Sourcing SIRET" } },
      { path: "mail", element: <MailTemplates scope="commercial" />, handle: { crumb: "Modèles mail" } },
      { path: "relance", element: <RelanceCommercial />, handle: { crumb: "Relances" } },
    ],
  },
  {
    path: "/rh",
    element: (
      <ProtectedRoute allowedRoles={[UserRole.RH]}>
        <RHLayout />
      </ProtectedRoute>
    ),
    handle: { crumb: "Espace RH" },
    children: [
      { index: true, element: <DashboardRH />, handle: { crumb: "Tableau de bord" } },
      { path: "candidats", element: <ListeCandidats />, handle: { crumb: "Candidats" } },
      { path: "candidats/:id", element: <FicheCandidat />, handle: { crumb: "Fiche candidat" } },
      { path: "candidats/:id/questionnaire", element: <QuestionnaireAB />, handle: { crumb: "Questionnaire" } },
      { path: "matching", element: <Matching />, handle: { crumb: "Matching" } },
      { path: "calendrier", element: <Calendrier />, handle: { crumb: "Calendrier" } },
      { path: "analyses-besoin", element: <ABEntreprisesRecues />, handle: { crumb: "Analyses de besoin" } },
      { path: "mail", element: <MailTemplates scope="rh" />, handle: { crumb: "Modèles mail" } },
      { path: "relance", element: <Relance />, handle: { crumb: "Relance" } },
      { path: "config-drive", element: <DriveConfig />, handle: { crumb: "Dossiers Drive" } },
      {
        path: "config-secteurs",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.RESPONSABLE]}>
            <SectorSettings />
          </ProtectedRoute>
        ),
        handle: { crumb: "Lieux par secteur" },
      },
    ],
  },
  {
    path: "/entreprise",
    element: (
      <ProtectedRoute allowedRoles={[UserRole.ENTREPRISE]}>
        <EntrepriseLayout />
      </ProtectedRoute>
    ),
    handle: { crumb: "Espace Entreprise" },
    children: [
      { index: true, element: <DashboardEntreprise />, handle: { crumb: "Tableau de bord" } },
      { path: "analyse-besoin", element: <FormulaireAB />, handle: { crumb: "Analyse de besoin" } },
      { path: "apprentis", element: <GestionApprentis />, handle: { crumb: "Apprentis" } },
      { path: "rendez-vous", element: <GestionRDV />, handle: { crumb: "Rendez-vous" } },
      { path: "profils", element: <ProfilsMatches />, handle: { crumb: "Profils" } },
    ],
  },
  {
    path: "/booking/:slug",
    element: <PublicBooking />,
  },
  {
    path: "/public/match",
    element: <MatchGate />,
  },
  {
    path: "/public/match/:signature",
    element: <MatchComparator />,
  },
  {
    path: "/public/interview",
    element: <InterviewGate />,
  },
  {
    path: "/public/interview/:signature",
    element: <InterviewSlotPicker />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
