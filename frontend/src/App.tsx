import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { LiveDashboard } from './components/dashboard/LiveDashboard';
import { HITLQueue } from './components/hitl/HITLQueue';
import { HealingEventsTable } from './components/healing/HealingEventsTable';
import { WorkflowList } from './components/workflows/WorkflowList';
import { SecurityView } from './components/security/SecurityView';
import { ComplianceView } from './components/compliance/ComplianceView';
import { RiskFeedView } from './components/risk/RiskFeedView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { IntegrationsGrid } from './components/integrations/IntegrationsGrid';
import { RunsList } from './components/runs/RunsList';
import { AutopsyList } from './components/analytics/AutopsyList';

export const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LiveDashboard />} />
          <Route path="workflows" element={<WorkflowList />} />
          <Route path="runs" element={<RunsList />} />
          <Route path="healing" element={<HealingEventsTable />} />
          <Route path="autopsy" element={<AutopsyList />} />
          <Route path="hitl" element={<HITLQueue />} />
          <Route path="compliance" element={<ComplianceView />} />
          <Route path="security" element={<SecurityView />} />
          <Route path="risk" element={<RiskFeedView />} />
          <Route path="analytics" element={<AnalyticsView />} />
          <Route path="integrations" element={<IntegrationsGrid />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
