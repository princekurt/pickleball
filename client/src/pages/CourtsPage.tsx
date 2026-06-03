import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import type { Court } from '@/types';

export function CourtsPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCourts = () => api.courts.list().then(setCourts).catch(() => {});

  useEffect(() => { fetchCourts(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await api.courts.create({ name: newName.trim() });
      setNewName('');
      fetchCourts();
      toast({ title: 'Court added' });
    } catch {
      toast({ title: 'Error', description: 'Failed to add court', variant: 'destructive' });
    }
  };

  const handleToggle = async (court: Court) => {
    const previousCourts = courts;
    setCourts(courts.map((c) => (c.id === court.id ? { ...c, isActive: !c.isActive } : c)));

    try {
      await api.courts.update(court.id, { isActive: !court.isActive });
      fetchCourts();
    } catch {
      setCourts(previousCourts);
      toast({ title: 'Error', description: 'Failed to update court', variant: 'destructive' });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const previousCourts = courts;
    const nextName = editName.trim();
    setCourts(courts.map((court) => (court.id === editingId ? { ...court, name: nextName } : court)));
    setEditingId(null);

    try {
      await api.courts.update(editingId, { name: nextName });
      fetchCourts();
      toast({ title: 'Court updated' });
    } catch {
      setCourts(previousCourts);
      toast({ title: 'Error', description: 'Failed to update court', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const previousCourts = courts;
    const id = deleteId;
    setCourts(courts.filter((court) => court.id !== id));
    setDeleteId(null);

    try {
      await api.courts.delete(id);
      fetchCourts();
      toast({ title: 'Court deleted' });
    } catch {
      setCourts(previousCourts);
      toast({ title: 'Error', description: 'Failed to delete court', variant: 'destructive' });
    }
  };

  return (
    <div className="md:ml-56 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Courts</h1>
        <p className="text-muted-foreground">Manage court names and availability.</p>
      </div>

      <div className="flex gap-2 max-w-md">
        <Input
          placeholder="Court name (e.g. Margaritaville Court)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd}><Plus className="h-4 w-4" /> Add</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courts.map((court) => (
          <Card key={court.id} className={!court.isActive ? 'opacity-60' : ''}>
            <CardContent className="flex items-center justify-between py-4">
              {editingId === court.id ? (
                <div className="flex gap-2 flex-1">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                  <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-medium">{court.name}</p>
                    <p className="text-xs text-muted-foreground">{court.isActive ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(court)}
                    >
                      {court.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingId(court.id); setEditName(court.name); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(court.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete court?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
