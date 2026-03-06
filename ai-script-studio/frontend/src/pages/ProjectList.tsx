import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

interface Project {
  project_id: number;
  project_name: string;
  genre: string;
  core_premise: string;
  status: string;
}

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/projects/`);
      setProjects(response.data);
    } catch (error) {
      message.error('加载项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await axios.post(`${API_BASE}/projects/`, values);
      message.success('项目创建成功');
      setModalVisible(false);
      form.resetFields();
      loadProjects();
    } catch (error) {
      message.error('创建项目失败');
    }
  };

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'project_name',
      key: 'project_name',
    },
    {
      title: '题材类型',
      dataIndex: 'genre',
      key: 'genre',
    },
    {
      title: '核心创意',
      dataIndex: 'core_premise',
      key: 'core_premise',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Project) => (
        <Button
          type="primary"
          onClick={() => navigate(`/pipeline/${record.project_id}`)}
        >
          进入工作台
        </Button>
      ),
    },
  ];

  return (
    <Card
      title="项目列表"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
        >
          新建项目
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={projects}
        rowKey="project_id"
        loading={loading}
      />

      <Modal
        title="创建新项目"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="project_name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="例如：都市奇幻短剧" />
          </Form.Item>

          <Form.Item
            name="genre"
            label="题材类型"
            rules={[{ required: true, message: '请选择题材类型' }]}
          >
            <Select>
              <Select.Option value="奇幻">奇幻</Select.Option>
              <Select.Option value="都市">都市</Select.Option>
              <Select.Option value="古装">古装</Select.Option>
              <Select.Option value="科幻">科幻</Select.Option>
              <Select.Option value="悬疑">悬疑</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="core_premise"
            label="核心创意"
            rules={[{ required: true, message: '请输入核心创意' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="用一句话描述你的故事核心创意..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ProjectList;
