import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import ProjectList from './pages/ProjectList';
import PipelineWorkbench from './pages/PipelineWorkbench';
import AgentConsole from './pages/AgentConsole';
import './App.css';

const { Header, Content } = Layout;

const App: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: '#001529',
        color: 'white',
        fontSize: '20px',
        fontWeight: 'bold'
      }}>
        AI Script Studio - 多Agent剧本创作系统
      </Header>
      <Content style={{ padding: '24px' }}>
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/pipeline/:projectId" element={<PipelineWorkbench />} />
          <Route path="/agents" element={<AgentConsole />} />
        </Routes>
      </Content>
    </Layout>
  );
};

export default App;
