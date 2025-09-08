type Props = {
  params: {
    sessionKey: string;
  };
};

export default async function SessionPage({ params }: Props) {
  // See https://nextjs.org/docs/messages/sync-dynamic-apis why await here
  const { sessionKey } = await params;
  return (
    <div className="h-full min-h-screen w-full flex items-center justify-center">
      Session {sessionKey}
    </div>
  );
}
