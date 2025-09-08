type Props = {
  params: {
    sessionKey: string;
  };
};

export default async function SessionPage({ params }: Props) {
  const { sessionKey } = await params;
  return (
    <div className="h-full min-h-screen w-full flex items-center justify-center">
      Session {sessionKey}
    </div>
  );
}
