import { Navigate, type RouteObject } from 'react-router';
import { PERMISSIONS } from '@/core/auth/permissions';
import { LandingLayout, PublicLayout, RootLayout } from './layouts';
import { NAV_ITEMS } from './navigation';
import { LandingPage } from './pages/LandingPage';
import { LazySystemDesignPage } from './pages/LazySystemDesignPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RequireAccess } from './RequireAccess';
import { PatientShell } from './shells/PatientShell';
import { StaffShell } from './shells/StaffShell';

/** Route-level code splitting: every screen loads on demand, so the 3D and charts stay out of the first paint. */
function screen<Name extends string>(load: () => Promise<Record<Name, React.ComponentType>>, name: Name) {
  return { lazy: async () => ({ Component: (await load())[name] }) };
}

/**
 * Route table. To add a screen: add a child under its zone here and, if it belongs in the rail or
 * the top bar, an item in `navigation.ts`. A zone's `RequireAccess` checks the role; a child can
 * add its own `RequireAccess permission`.
 */
export const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { element: <LandingLayout />, children: [{ index: true, element: <LandingPage /> }] },
      {
        element: <PublicLayout />,
        children: [
          { path: 'login', ...screen(() => import('./pages/access/LoginPage'), 'LoginPage') },
          { path: 'activate', ...screen(() => import('./pages/access/ActivationPage'), 'ActivationPage') },
          { path: 'mfa/enrollment', ...screen(() => import('./pages/access/MfaEnrollmentPage'), 'MfaEnrollmentPage') },
          { path: 'dev/system', element: <LazySystemDesignPage /> },
        ],
      },
      {
        path: 'doctor',
        element: <RequireAccess roles={['DOCTOR']} />,
        children: [
          {
            element: <StaffShell items={NAV_ITEMS.DOCTOR} />,
            children: [
              { index: true, element: <Navigate to="triage" replace /> },
              {
                element: <RequireAccess permission={PERMISSIONS.triageRead} />,
                children: [{ path: 'triage', ...screen(() => import('./pages/doctor/TriagePage'), 'TriagePage') }],
              },
              {
                element: <RequireAccess permission={PERMISSIONS.alertsRead} />,
                children: [{ path: 'alerts', ...screen(() => import('./pages/doctor/AlertsPage'), 'AlertsPage') }],
              },
              {
                element: <RequireAccess permission={PERMISSIONS.patientRead} />,
                children: [
                  {
                    path: 'patients/:patientId',
                    ...screen(() => import('./pages/doctor/PatientDetailPage'), 'PatientDetailPage'),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: 'admin',
        element: <RequireAccess roles={['CLINIC_ADMIN']} />,
        children: [
          {
            element: <StaffShell items={NAV_ITEMS.CLINIC_ADMIN} />,
            children: [
              { index: true, element: <Navigate to="patients" replace /> },
              { path: 'patients', ...screen(() => import('./pages/admin/RosterPage'), 'RosterPage') },
              { path: 'imports', ...screen(() => import('./pages/admin/ImportsPage'), 'ImportsPage') },
              { path: 'credentials', ...screen(() => import('./pages/admin/CredentialsPage'), 'CredentialsPage') },
              { path: 'care-teams', ...screen(() => import('./pages/admin/CareTeamsPage'), 'CareTeamsPage') },
              { path: 'staff', ...screen(() => import('./pages/admin/StaffPage'), 'StaffPage') },
            ],
          },
        ],
      },
      {
        path: 'patient',
        element: <RequireAccess roles={['PATIENT']} />,
        children: [
          {
            element: <PatientShell items={NAV_ITEMS.PATIENT} />,
            children: [
              { index: true, ...screen(() => import('./pages/patient/PatientHomePage'), 'PatientHomePage') },
              { path: 'readings', ...screen(() => import('./pages/patient/ReadingsPage'), 'ReadingsPage') },
              { path: 'plan', ...screen(() => import('./pages/patient/PlanPage'), 'PlanPage') },
              { path: 'messages', ...screen(() => import('./pages/patient/MessagesPage'), 'MessagesPage') },
            ],
          },
        ],
      },
      { element: <PublicLayout />, children: [{ path: '*', element: <NotFoundPage /> }] },
    ],
  },
];
