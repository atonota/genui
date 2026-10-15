import '../styles/atlas-feedback.css';
import { useState, type ReactElement } from 'react';
import AtlasProvider from './AtlasProvider';
import AtlasButton from './AtlasButton';
import { AtlasCard } from './cards/AtlasCard';
import { useI18n } from './useI18n';
import {
  AtlasAlert,
  AtlasFeedbackScope,
  AtlasModal,
  AtlasPopconfirm,
  useAtlasNotification,
  useAtlasToast,
  type AtlasFeedbackStatus,
  type AtlasToastPlacement,
} from './AtlasFeedback';

export type FeedbackKind = 'toast' | 'alert' | 'notification' | 'modal' | 'popconfirm';
export interface FeedbackDemoProps {
  documentation?: boolean;
  kind?: FeedbackKind;
}
export type FeedbackExampleProps = Pick<FeedbackDemoProps, 'documentation'>;

const toastTriggers: { placement: AtlasToastPlacement; label: string }[] = [
  { placement: 'top-center', label: 'Toast · top center' },
  { placement: 'top-right-top', label: 'Toast · top right from top' },
  { placement: 'top-right-right', label: 'Toast · top right from right' },
];

function ToastExample() {
  const { t } = useI18n();
  const [toast, toastHolder] = useAtlasToast();
  const [saved, setSaved] = useState(false);
  return (
    <>
      {toastHolder}
      <AtlasCard
        title={t('Toast')}
        description={t('Short confirmation that appears briefly and does not take focus.')}
        actions={toastTriggers.map(({ placement, label }) => (
          <AtlasButton
            key={placement}
            text={t(label)}
            onClick={() => {
              setSaved(true);
              toast.open({ placement, status: 'success', content: t('Saved locally.') });
            }}
          />
        ))}
      >
        <p className="atlas-feedback-result" data-feedback-result={saved ? 'saved' : 'idle'}>
          {saved ? t('Saved locally.') : t('Nothing saved yet.')}
        </p>
      </AtlasCard>
    </>
  );
}

const alerts: { status: AtlasFeedbackStatus; title: string; description: string }[] = [
  {
    status: 'info',
    title: 'Changes stay in this browser.',
    description: 'Nothing is sent to a server while you try these examples.',
  },
  {
    status: 'success',
    title: 'Draft saved locally.',
    description: 'This example stays available while this page is open.',
  },
  {
    status: 'warning',
    title: 'Two fields need review.',
    description: 'Check the highlighted fields before you continue.',
  },
  {
    status: 'error',
    title: 'This file could not be read.',
    description: 'Choose another file in a supported format.',
  },
];

function AlertExample() {
  const { t } = useI18n();
  return (
    <AtlasCard
      title={t('Alert')}
      description={t('Persistent message that stays in the page until the situation changes.')}
    >
      <div className="atlas-feedback-stack">
        {alerts.map(alert => (
          <AtlasAlert
            key={alert.status}
            status={alert.status}
            title={t(alert.title)}
            description={t(alert.description)}
            dismissible={alert.status === 'warning'}
          />
        ))}
      </div>
    </AtlasCard>
  );
}

const draftNotification = 'atlas-feedback-draft';

function NotificationExample() {
  const { t } = useI18n();
  const [notify, notificationHolder] = useAtlasNotification();
  return (
    <>
      {notificationHolder}
      <AtlasCard
        title={t('Notification')}
        description={t('Richer message with a title, description and actions.')}
        actions={
          <AtlasButton
            text={t('Show notification')}
            onClick={() =>
              notify.open({
                key: draftNotification,
                status: 'info',
                title: t('Draft kept in this browser'),
                description: t('Nothing was sent. Keep editing or close this message.'),
                actions: (
                  <AtlasButton
                    fill="text"
                    text={t('Keep editing')}
                    onClick={() => notify.destroy(draftNotification)}
                  />
                ),
              })
            }
          />
        }
      />
    </>
  );
}

const reviewChanges = ['Title changed to Quarterly plan.', 'Two tags were added.'];

function ModalExample() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  return (
    <>
      <AtlasCard
        title={t('Modal')}
        description={t('Focused review step that keeps the page behind it unchanged.')}
        actions={<AtlasButton text={t('Review changes')} onClick={() => setOpen(true)} />}
      >
        <p className="atlas-feedback-result" data-feedback-result={applied ? 'applied' : 'idle'}>
          {applied ? t('Changes applied locally.') : t('2 changes waiting for review.')}
        </p>
      </AtlasCard>
      <AtlasModal
        open={open}
        title={t('Review local changes')}
        onCancel={() => setOpen(false)}
        footer={
          <div className="atlas-feedback-modal-actions">
            <AtlasButton fill="text" text={t('Cancel')} onClick={() => setOpen(false)} />
            <AtlasButton
              text={t('Apply changes')}
              onClick={() => {
                setApplied(true);
                setOpen(false);
              }}
            />
          </div>
        }
      >
        <ul className="atlas-feedback-list">
          {reviewChanges.map(change => (
            <li key={change}>{t(change)}</li>
          ))}
        </ul>
        <p className="atlas-feedback-result">
          {t('Applying updates this example only. Nothing is sent to a server.')}
        </p>
      </AtlasModal>
    </>
  );
}

function PopconfirmExample() {
  const { t } = useI18n();
  const [archived, setArchived] = useState(false);
  return (
    <AtlasCard
      title={t('Popconfirm')}
      description={t('Small confirmation next to the action it protects.')}
      actions={
        <AtlasPopconfirm
          title={t('Archive this sample?')}
          description={t('It moves to the local archive in this browser.')}
          okText={t('Archive')}
          cancelText={t('Cancel')}
          disabled={archived}
          onConfirm={() => setArchived(true)}
        >
          <AtlasButton text={t('Archive sample')} disabled={archived} />
        </AtlasPopconfirm>
      }
    >
      <p className="atlas-feedback-result" data-feedback-result={archived ? 'archived' : 'active'}>
        {t('Status')}:{' '}
        <span role="status" aria-live="polite">
          {archived ? t('Archived locally') : t('Active')}
        </span>
      </p>
    </AtlasCard>
  );
}

const examples: Record<FeedbackKind, () => ReactElement> = {
  toast: ToastExample,
  alert: AlertExample,
  notification: NotificationExample,
  modal: ModalExample,
  popconfirm: PopconfirmExample,
};

export default function FeedbackDemo({ documentation = false, kind = 'toast' }: FeedbackDemoProps) {
  const Example = examples[kind] ?? examples.toast;
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <div className="atlas-feedback-demo" data-demo={kind}>
        <AtlasFeedbackScope>
          <Example />
        </AtlasFeedbackScope>
      </div>
    </AtlasProvider>
  );
}

export function ToastDemo({ documentation = false }: FeedbackExampleProps) {
  return <FeedbackDemo documentation={documentation} kind="toast" />;
}

export function AlertDemo({ documentation = false }: FeedbackExampleProps) {
  return <FeedbackDemo documentation={documentation} kind="alert" />;
}

export function NotificationDemo({ documentation = false }: FeedbackExampleProps) {
  return <FeedbackDemo documentation={documentation} kind="notification" />;
}

export function ModalDemo({ documentation = false }: FeedbackExampleProps) {
  return <FeedbackDemo documentation={documentation} kind="modal" />;
}

export function PopconfirmDemo({ documentation = false }: FeedbackExampleProps) {
  return <FeedbackDemo documentation={documentation} kind="popconfirm" />;
}
