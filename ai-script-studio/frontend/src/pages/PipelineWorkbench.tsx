import React, { useState } from 'react';
import { Card, Steps, Button, Spin, message } from 'antd';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

const PipelineWorkbench: React.FC = () => {
  const { projectId } = useParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [outlineData, setOutlineData] = useState<any>(null);
  const [settingsData, setSettingsData] = useState<any>(null);
  const [taskId, setTaskId] = useState<number | null>(null);

  const handleGenerateOutline = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/pipeline/generate-outline`, {
        project_id: parseInt(projectId!)
      });
      setOutlineData(response.data.outline_data);
      setTaskId(response.data.task_id);
      setCurrentStep(1);
      message.success('大纲生成成功');
    } catch (error) {
      message.error('大纲生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractSettings = async () => {
    if (!taskId) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/pipeline/extract-settings`, null, {
        params: { task_id: taskId }
      });
      setSettingsData(response.data.settings_data);
      setCurrentStep(2);
      message.success('设定提取成功');
    } catch (error) {
      message.error('设定提取失败');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '概念录入',
      description: '输入核心创意',
    },
    {
      title: '大纲生成',
      description: 'Agent 1 - 总控编剧',
    },
    {
      title: '设定提取',
      description: 'Agent 2 - 视觉架构师',
    },
    {
      title: '场次切片',
      description: 'Agent 3 - 场次切片大师',
    },
    {
      title: '分镜生成',
      description: 'Agent 4 - 分镜脚本执笔',
    },
    {
      title: '质检导出',
      description: 'Agent 5 - 场记审核',
    },
  ];

  return (
    <div>
      <Card title="IP孵化工作台" style={{ marginBottom: 24 }}>
        <Steps current={currentStep} items={steps} />
      </Card>

      <Card>
        <Spin spinning={loading}>
          {currentStep === 0 && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Button
                type="primary"
                size="large"
                onClick={handleGenerateOutline}
              >
                开始生成大纲
              </Button>
            </div>
          )}

          {currentStep === 1 && outlineData && (
            <div>
              <h3>大纲预览</h3>
              <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
                {JSON.stringify(outlineData, null, 2)}
              </pre>
              <Button
                type="primary"
                onClick={handleExtractSettings}
                style={{ marginTop: 16 }}
              >
                确认大纲，提取设定
              </Button>
            </div>
          )}

          {currentStep === 2 && settingsData && (
            <div>
              <h3>设定词典</h3>
              <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
                {JSON.stringify(settingsData, null, 2)}
              </pre>
              <Button
                type="primary"
                style={{ marginTop: 16 }}
              >
                确认设定，生成细纲
              </Button>
            </div>
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default PipelineWorkbench;
