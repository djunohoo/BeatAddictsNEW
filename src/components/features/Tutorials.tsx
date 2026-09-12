import { BookOpen, GraduationCap } from 'lucide-react';

export const Tutorials = () => {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Learning Center</h2>
          <p className="text-muted-foreground">Master music production with guided tutorials</p>
        </div>

        <div className="glass-panel rounded-xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-neon-purple/20 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-neon-purple" />
          </div>
          <h3 className="text-xl font-bold">Coming soon</h3>
          <p className="text-muted-foreground max-w-md">
            No courses or tutorials exist yet — this section is a placeholder for a
            future Learning Center. Nothing here is trackable progress today, so we're
            not showing fake course lists or completion stats.
          </p>
        </div>

        <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
          <BookOpen className="w-4 h-4" />
          <span>Want to help shape what goes here? Let the team know what you'd want to learn first.</span>
        </div>
      </div>
    </div>
  );
};
