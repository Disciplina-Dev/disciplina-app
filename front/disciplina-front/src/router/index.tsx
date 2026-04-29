import { createBrowserRouter } from "react-router-dom";

import SelectProfil from "@/pages/SelectProfil";
import NotFound from "@/pages/NotFound";
import Drive from "@/pages/Drive";

import AuthLayout from "@/components/layout/AuthLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

import CommercialLayout from "@/components/layout/CommercialLayout";
import DashboardCommercial from "@/pages/commercial/DashboardCommercial";
import ListeAB from "@/pages/commercial/ListeAB";
import CreateAB from "@/pages/commercial/CreateAB";
import PortefeuilleEntreprises from "@/pages/commercial/PortefeuilleEntreprises";

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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <SelectProfil />,
  },
  {
    path: "/drive",
    element: (
      <ProtectedRoute>
        <Drive />
      </ProtectedRoute>
    ),
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { 
        path: "/register", 
        element: (
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <RegisterPage />
          </ProtectedRoute>
        )
      },
    ],
  },
  {
    path: "/commercial",
    element: (
      <ProtectedRoute allowedRoles={['COMMERCIAL']}>
        <CommercialLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardCommercial /> },
      { path: "analyses-besoin", element: <ListeAB /> },
      { path: "analyses-besoin/nouvelle", element: <CreateAB /> },
      { path: "portefeuille", element: <PortefeuilleEntreprises /> },
    ],
  },
  {
    path: "/rh",
    element: (
      <ProtectedRoute allowedRoles={['RH']}>
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
      { path: "mail", element: <MailTemplates /> },
      { path: "relance", element: <Relance /> },
    ],
  },
  {
    path: "/entreprise",
    element: (
      <ProtectedRoute allowedRoles={['ENTREPRISE']}>
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
    path: "*",
    element: <NotFound />,
  },
]);
